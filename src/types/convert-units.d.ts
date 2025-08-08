// src/types/convert-units.d.ts
declare module 'convert-units' {
  type Unit = string;

  interface ToBestOptions {
    exclude?: Unit[];
    cutOffNumber?: number;
    system?: 'imperial' | 'metric';
  }

  interface Conversion {
    from(fromUnit: Unit): {
      to(toUnit: Unit): number;
      toBest(options?: ToBestOptions): { val: number; unit: Unit };
    };
  }

  const convert: (value: number) => Conversion;

  export default convert;
}
