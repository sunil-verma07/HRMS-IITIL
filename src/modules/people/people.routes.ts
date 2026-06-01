import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { singleFileUpload } from '../../middlewares/file-upload';
import { validateRequest } from '../../middlewares/validate-request';
import { PeopleController } from './people.controller';
import { importConfirmSchema, peopleIdParamSchema, peopleQuerySchema } from './people.validation';

const router = Router();
const controller = new PeopleController();

router.get('/people', authenticate, validateRequest({ query: peopleQuerySchema }), asyncHandler(controller.listPeople));
router.get('/people/filters', authenticate, asyncHandler(controller.peopleFilters));
router.get('/people/:id', authenticate, validateRequest({ params: peopleIdParamSchema }), asyncHandler(controller.getPerson));
router.post(
  '/people/bulk-import',
  authenticate,
  authorize('employee.write'),
  singleFileUpload({
    fieldName: 'file',
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
  }),
  asyncHandler(controller.bulkImport)
);
router.post(
  '/people/bulk-import/confirm',
  authenticate,
  authorize('employee.write'),
  validateRequest({ body: importConfirmSchema }),
  asyncHandler(controller.confirmBulkImport)
);

export { router as peopleRoutes };
