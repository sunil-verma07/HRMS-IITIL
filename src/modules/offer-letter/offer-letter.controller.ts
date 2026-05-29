import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { parsePagination, paginated, pageArgs } from "../../common/utils/controller-helpers";
import { BadRequestError, ConflictError, NotFoundError } from "../../common/errors/app-error";
import { FileStorageService } from "../../services/storage/file-storage.service";

const storage = new FileStorageService();

export class OfferLetterController {
  private extractVariables(html: string): string[] {
    const matches = html.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
    const vars = new Set<string>();
    for (const match of matches) vars.add(match[1]);
    return Array.from(vars);
  }

  private interpolate(template: string, variables: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), String(value ?? ""));
    }
    return result;
  }

  private sanitize(html: string): string {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }

  offerLetters = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.offerLetter.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { template: { select: { id: true, name: true, key: true } } },
      }),
      prisma.offerLetter.count({ where: { deletedAt: null } }),
    ]);
    return sendSuccess(response, "Offer letters retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  generateOfferLetter = async (request: Request, response: Response): Promise<Response> => {
    const templateId = typeof request.body.templateId === "string" ? request.body.templateId : undefined;
    const variables =
      request.body.variables && typeof request.body.variables === "object"
        ? (request.body.variables as Record<string, unknown>)
        : {};

    if (!templateId) throw new BadRequestError("Template is required");

    const template = await prisma.template.findFirst({ where: { id: templateId, deletedAt: null } });
    if (!template) throw new NotFoundError("Template not found");

    const finalHtml = this.sanitize(this.interpolate(template.htmlContent, variables));
    const finalCss = template.cssContent ? this.sanitize(template.cssContent) : "";

    const offer = await prisma.offerLetter.create({
      data: {
        templateId,
        variables: variables as Prisma.InputJsonValue,
        generatedUrl: "",
        status: "DRAFT",
      },
      include: { template: { select: { id: true, name: true, key: true } } },
    });

    await prisma.offerLetter.update({
      where: { id: offer.id },
      data: { generatedUrl: `/api/v1/offer-letters/${offer.id}/download` },
    });

    // Prune: keep only 5 most recent
    const all = await prisma.offerLetter.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (all.length > 5) {
      const toDelete = all.slice(5).map((o) => o.id);
      await prisma.offerLetter.updateMany({
        where: { id: { in: toDelete } },
        data: { deletedAt: new Date() },
      });
    }

    return sendSuccess(
      response,
      "Offer letter generated",
      { ...offer, generatedHtml: `<style>${finalCss}</style>${finalHtml}` },
      HttpStatus.CREATED
    );
  };

  downloadOfferLetter = async (request: Request, response: Response): Promise<void> => {
    const id = request.params.id;
    if (!id) throw new BadRequestError("Offer letter id is required");

    const offer = await prisma.offerLetter.findFirst({ where: { id, deletedAt: null } });
    if (!offer) throw new NotFoundError("Offer letter not found");

    const template = await prisma.template.findUnique({ where: { id: offer.templateId } });
    if (!template) throw new NotFoundError("Template not found");

    const variables =
      offer.variables && typeof offer.variables === "object"
        ? (offer.variables as Record<string, unknown>)
        : {};

    const html = this.sanitize(this.interpolate(template.htmlContent, variables));
    const css = template.cssContent ? this.sanitize(template.cssContent) : "";

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="offer-${offer.id}.html"`);
    response.send(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  };

  templates = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const search = query.search;
    const where = {
      deletedAt: null,
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { key: { contains: search, mode: "insensitive" as const } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.template.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, key: true, category: true, htmlContent: true, cssContent: true, variables: true, isDefault: true, previewImage: true, createdAt: true, updatedAt: true },
      }),
      prisma.template.count({ where }),
    ]);
    return sendSuccess(response, "Templates retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  createTemplate = async (request: Request, response: Response): Promise<Response> => {
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    const key = typeof request.body.key === "string" ? request.body.key.trim() : "";
    const htmlContent = typeof request.body.htmlContent === "string" ? this.sanitize(request.body.htmlContent) : "";
    const cssContent = typeof request.body.cssContent === "string" ? this.sanitize(request.body.cssContent) : undefined;
    const category = typeof request.body.category === "string" ? request.body.category.trim() : undefined;
    const isDefault = request.body.isDefault === true;

    if (!name || !key || !htmlContent) throw new BadRequestError("Template name, key, and HTML content are required");

    const existing = await prisma.template.findFirst({ where: { key, deletedAt: null }, select: { id: true } });
    if (existing) throw new ConflictError("Template key already exists");

    if (isDefault) {
      await prisma.template.updateMany({ where: { isDefault: true, deletedAt: null }, data: { isDefault: false } });
    }

    const variables = this.extractVariables(htmlContent);

    const template = await prisma.template.create({
      data: { name, key, htmlContent, variables, isDefault, ...(cssContent ? { cssContent } : {}), ...(category ? { category } : {}) },
    });

    return sendSuccess(response, "Template created", template, HttpStatus.CREATED);
  };

  updateTemplate = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    if (!id) throw new BadRequestError("Template id is required");

    const existing = await prisma.template.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundError("Template not found");

    const isDefault = request.body.isDefault === true;
    if (isDefault) {
      await prisma.template.updateMany({ where: { isDefault: true, deletedAt: null, id: { not: id } }, data: { isDefault: false } });
    }

    const htmlContent = typeof request.body.htmlContent === "string" ? this.sanitize(request.body.htmlContent) : undefined;
    const variables = htmlContent ? this.extractVariables(htmlContent) : undefined;

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(typeof request.body.name === "string" ? { name: request.body.name.trim() } : {}),
        ...(typeof request.body.key === "string" ? { key: request.body.key.trim() } : {}),
        ...(htmlContent ? { htmlContent, variables } : {}),
        ...(typeof request.body.cssContent === "string" ? { cssContent: this.sanitize(request.body.cssContent) } : {}),
        ...(typeof request.body.category === "string" ? { category: request.body.category.trim() } : {}),
        ...(request.body.isDefault !== undefined ? { isDefault } : {}),
      },
    });

    return sendSuccess(response, "Template updated", template, HttpStatus.OK);
  };

  deleteTemplate = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    if (!id) throw new BadRequestError("Template id is required");

    const existing = await prisma.template.findFirst({ where: { id, deletedAt: null }, select: { id: true, isDefault: true } });
    if (!existing) throw new NotFoundError("Template not found");

    if (existing.isDefault) throw new BadRequestError("Cannot delete the default template. Set another template as default first.");

    const inUse = await prisma.offerLetter.findFirst({ where: { templateId: id, deletedAt: null }, select: { id: true } });
    if (inUse) throw new BadRequestError("Cannot delete a template that has generated offer letters.");

    await prisma.template.update({ where: { id }, data: { deletedAt: new Date() } });

    return sendSuccess(response, "Template deleted", null, HttpStatus.OK);
  };

  uploadTemplateImage = async (request: Request, response: Response): Promise<Response> => {
    const file = request.file;
    if (!file) throw new BadRequestError("Image file is required");

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestError("Only JPEG, PNG, WebP, SVG and GIF images are allowed");
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) throw new BadRequestError("Image must be under 5 MB");

    const ext = file.originalname.split(".").pop() ?? "jpg";
    const fileName = `template-img-${Date.now()}.${ext}`;

    const result = await storage.client.upload({
      buffer: file.buffer,
      fileName,
      mimeType: file.mimetype,
      folder: "templates",
    });

    return sendSuccess(response, "Image uploaded", { url: result.url, key: result.key }, HttpStatus.CREATED);
  };

  setDefaultTemplate = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    if (!id) throw new BadRequestError("Template id is required");

    const existing = await prisma.template.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundError("Template not found");

    await prisma.template.updateMany({ where: { isDefault: true, deletedAt: null }, data: { isDefault: false } });
    const template = await prisma.template.update({ where: { id }, data: { isDefault: true } });

    return sendSuccess(response, "Default template updated", template, HttpStatus.OK);
  };
}