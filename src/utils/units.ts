// src/utils/units.ts

/**
 * SI units grouped by category for select dropdowns.
 * Values are kept as display strings and are not normalized here.
 * v0.5: expanded for general engineering (civil/structural, instrumentation, concentration).
 */
export const groupedSIUnits: Record<string, string[]> = {
  Acceleration: ['m/s²'],
  Area: ['m²', 'cm²', 'm2.K/W'],
  Concentration: ['ppm', 'mg/L'],
  Density: ['kg/m³', 'kg/m3'],
  Efficiency: ['%', '% w/w', '% v/v', '% w/v'],
  Electrical: ['A', 'mA', 'V', 'Ω', 'W', 'kW', 'Wh', 'kWh', 'VA', 'var', 'Hz'],
  Energy: ['kJ/kg.K', 'kJ/kg @ °C'],
  Force: ['N', 'kN', 'kg/m.s2'],
  Length: ['m', 'cm', 'mm', 'μm'],
  MassFlowRate: ['kg/h'],
  Others: ['tons/day', 'mol %', 'vol%', 'Dyne/cm'],
  Power: ['W', 'kW'],
  Pressure: ['Pa', 'bar', 'kPa', 'kPa(a)', 'kPa(g)', 'MPa', 'N/mm²', 'bar(g)'],
  SpecificHeat: ['Cp'],
  Temperature: ['°C'],
  ThermalConductivity: ['W/m.K', 'W/m2.K'],
  Time: ['hr/yr', 'rpm'],
  Torque: ['kg·m'],
  Velocity: ['m/s', 'km/h'],
  Viscosity: ['Pa·s', 'mPa.s', 'cP'],
  Volume: ['m³', 'L', 'm³/min'],
  VolumeFlowRate: ['m³/h', 'L/min', 'Nm³/h'],
  Weight: ['kg', 'g'],
}
