export default function BrandLogo({ size=40 }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/vohala-logo.svg" width={size*2} height={size} alt="Vohala" />
      <span className="font-extrabold text-xl">Vohala Social</span>
    </div>
  )
}
