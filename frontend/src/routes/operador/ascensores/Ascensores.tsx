import { Route, Routes } from 'react-router-dom'
import { Explorador } from './Explorador'
import { FichaEdificio } from './FichaEdificio'
import { FichaEquipo } from './FichaEquipo'

/** `/operador/ascensores/*`: drill-down Cliente → Administración → Edificio → Equipo. */
export function Ascensores() {
  return (
    <Routes>
      <Route index element={<Explorador />} />
      <Route path="edificios/:id" element={<FichaEdificio />} />
      <Route path="equipos/:id" element={<FichaEquipo />} />
    </Routes>
  )
}
