import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { MapPage } from '../pages/MapPage'
import { CityPage } from '../pages/CityPage'
import { StreetPage } from '../pages/StreetPage'
import { HousePage } from '../pages/HousePage'
import { NotFoundPage } from '../pages/NotFoundPage'

/**
 * Маршруты каталога повторяют слаги из БД: /moskva/tverskaya-ulica/12.
 * Те же адреса рендерит бэкенд для поисковиков, поэтому менять их структуру
 * нельзя в отрыве от него — и от уже проиндексированных страниц.
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <MapPage /> },
      { path: '/:citySlug', element: <CityPage /> },
      { path: '/:citySlug/:streetSlug', element: <StreetPage /> },
      { path: '/:citySlug/:streetSlug/:houseSlug', element: <HousePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
