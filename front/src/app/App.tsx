import { RouterProvider } from 'react-router-dom'
import { router } from './routes'

/** Корень приложения: всё остальное разводит роутер */
export function App() {
  return <RouterProvider router={router} />
}
