export function Proximamente({ titulo }: { titulo: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-400">
      <h2 className="text-lg font-medium text-gray-500">{titulo}</h2>
      <p className="text-sm">Próximamente</p>
    </div>
  )
}
