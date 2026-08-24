import Image from "next/image";

export function CurrentImageControl({
  src,
  alt,
  removeName,
  variant = "cover",
}: {
  src: string;
  alt: string;
  removeName: string;
  variant?: "cover" | "logo";
}) {
  const isLogo = variant === "logo";

  return (
    <div
      className="current-image-control"
      style={isLogo ? { gridTemplateColumns: "5rem minmax(0, 1fr)" } : undefined}
    >
      <div
        className="current-image-preview"
        style={isLogo ? { aspectRatio: "1", padding: ".45rem" } : undefined}
      >
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized={src.startsWith("/media/")}
          sizes="12rem"
          className={isLogo ? "object-contain" : "object-cover"}
        />
      </div>
      <label className="image-remove-control">
        <input type="checkbox" name={removeName} />
        <span>Remover imagem atual ao salvar</span>
      </label>
    </div>
  );
}
