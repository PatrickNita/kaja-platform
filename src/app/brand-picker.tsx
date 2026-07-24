"use client";

import { useState } from "react";

export type Brand = "kaja" | "hexenwerk" | "virginia";

export const brandOptions = [
  { key: "kaja", label: "KAJA" },
  { key: "hexenwerk", label: "HEXENWERK" },
  { key: "virginia", label: "VIRGINIA" },
] as const satisfies ReadonlyArray<{ key: Brand; label: string }>;

export function BrandPicker({
  value,
  onChange,
  disabled = false,
  legend = "Brand",
}: {
  value: Brand | "";
  onChange: (brand: Brand) => void;
  disabled?: boolean;
  legend?: string;
}) {
  return (
    <fieldset className="brand-picker" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="brand-picker-options">
        {brandOptions.map((brand) => {
          const selected = value === brand.key;
          return (
            <button
              key={brand.key}
              type="button"
              className={`task-member-chip picker brand-picker-option${selected ? " selected" : ""}`}
              aria-pressed={selected}
              onClick={() => onChange(brand.key)}
            >
              <span aria-hidden="true">{selected ? "✓" : "+"}</span>
              {brand.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function BrandFormPicker({
  initialBrand,
  legend = "Brand",
}: {
  initialBrand?: Brand;
  legend?: string;
}) {
  const [brand, setBrand] = useState<Brand | "">(initialBrand ?? "");

  return (
    <>
      <BrandPicker value={brand} onChange={setBrand} legend={legend} />
      <select
        name="brand"
        value={brand}
        onChange={(event) => setBrand(event.target.value as Brand | "")}
        required
        aria-label="Brand selectat"
        className="brand-picker-native"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <option value="">Alege brandul</option>
        {brandOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
