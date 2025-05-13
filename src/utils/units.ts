// src/utils/units.ts

/**
 * SI Units grouped by category for select dropdowns
 */
export const groupedSIUnits: Record<string, string[]> = {
    Length: ['m', 'cm', 'mm'],
    Weight: ['kg', 'g', 'mg', 't'],
    Area: ['m²', 'cm²'],
    Volume: ['m³', 'cm³', 'L', 'mL'],
    Pressure: ['Pa', 'bar', 'kPa'],
    Temperature: ['K', '°C'],
    Density: ['kg/m³'],
    Energy: ['kJ', 'J'],
    MassFlowRate: ['kg/h', 'kg/s'],
    VolumeFlowRate: ['m³/h', 'm³/s', 'L/min', 'L/s'],
    LiquidFlowRate: ['L/min', 'L/s'],
    Velocity: ['m/s', 'km/h'],
    Acceleration: ['m/s²'],
    Power: ['kW'],
    Viscosity: ['Pa·s'],
    Force: ['N'],
    Time: ['s', 'min', 'h'],
  };
  