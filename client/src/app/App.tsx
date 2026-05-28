import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProviders } from '@/providers/AppProviders';
import { router } from '@/routes/router';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'glass-panel border-border text-foreground',
            title: 'text-foreground',
            description: 'text-muted-foreground'
          }
        }}
      />
    </AppProviders>
  );
}
