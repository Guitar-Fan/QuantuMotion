import { AtomType, AtomData, BondData, ElectronState, MoleculeTemplate, OrbitalType } from './types';
import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';

// Physics Constants
export const K_COULOMB = 350.0; 
export const DAMPING = 0.98; 
export const LJ_EPSILON = 5.0; 
export const LJ_SIGMA_SCALE = 0.85; 
export const BOND_FORM_RADIUS = 1.3; // Reduced from 1.4 to require closer proximity
export const CONTAINER_SIZE = 25.0; 
export const PROXIMITY_LIMIT = 15.0; 
export const BOND_STRENGTH_COVALENT = 1200; // Increased base strength
export const BOND_STRENGTH_IONIC = 800;     // Increased base strength

// Bond Dynamics
export const BOND_BREAK_RATIO = 2.0; // Increased to allow more stretch before mechanical snap, relying on thermal breaking
export const THERMAL_EXPANSION_COEFF = 0.005; 

// Visualization
export const FIELD_GRID_SIZE = 20; 
export const FIELD_GRID_STEP = (CONTAINER_SIZE * 2) / FIELD_GRID_SIZE;

// Fun Mode Mappings (Creativity Factor)
export const ATOM_EMOJIS: Record<string, string> = {
  'H': '🎈',   // Hydrogen
  'He': '🐿️',  // Helium
  'Li': '🔋',  // Lithium
  'Be': '🛸',  // Beryllium
  'C': '✏️',   // Carbon
  'N': '🥶',   // Nitrogen
  'O': '😤',   // Oxygen
  'F': '🪥',   // Fluorine
  'Ne': '🚥',  // Neon
  'Na': '🧂',  // Sodium
  'P': '🧨',   // Phosphorus
  'S': '🦨',   // Sulfur
  'Cl': '🏊',  // Chlorine
};

const assignOrbitals = (n: number, sub: 's'|'p', count: number, startIdx: number = 0): { type: OrbitalType, isValence: boolean }[] => {
    const orbitals: { type: OrbitalType, isValence: boolean }[] = [];
    const isValence = true; 

    if (sub === 's') {
        const label = `${n}s` as OrbitalType;
        for(let i=0; i<count; i++) orbitals.push({ type: label, isValence });
    } else if (sub === 'p') {
        const axes = ['x', 'y', 'z'];
        for(let i=0; i<count; i++) {
            const axis = axes[i % 3]; 
            const label = `${n}p${axis}` as OrbitalType;
            orbitals.push({ type: label, isValence });
        }
    }
    return orbitals;
};

export const ATOM_CONFIGS: Record<AtomType, { 
  mass: number; 
  charge: number; 
  radius: number; 
  color: string; 
  atomicNumber: number;
  valenceCount: number; 
  electronegativity: number;
  maxBonds: number; 
  meltingPoint: number;
  boilingPoint: number;
  orbitals: { type: OrbitalType, isValence: boolean }[];
}> = {
  [AtomType.Hydrogen]: { 
    mass: 1, charge: 1, radius: 0.5, color: '#FFFFFF', atomicNumber: 1, valenceCount: 1, electronegativity: 2.20, maxBonds: 1,
    meltingPoint: 0.5, boilingPoint: 1.0,
    orbitals: [{ type: '1s', isValence: true }]
  },
  [AtomType.Helium]: { 
    mass: 4, charge: 0, radius: 0.4, color: '#FFC0CB', atomicNumber: 2, valenceCount: 2, electronegativity: 0, maxBonds: 0,
    meltingPoint: 0.1, boilingPoint: 0.2,
    orbitals: assignOrbitals(1, 's', 2)
  },
  [AtomType.Lithium]: {
    mass: 7, charge: 1, radius: 1.2, color: '#CC80FF', atomicNumber: 3, valenceCount: 1, electronegativity: 0.98, maxBonds: 1,
    meltingPoint: 4.5, boilingPoint: 8.0, 
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 1)]
  },
  [AtomType.Beryllium]: {
    mass: 9, charge: 2, radius: 1.0, color: '#C2FF00', atomicNumber: 4, valenceCount: 2, electronegativity: 1.57, maxBonds: 2,
    meltingPoint: 6.0, boilingPoint: 9.0,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2)]
  },
  [AtomType.Carbon]: { 
    mass: 12, charge: 0, radius: 0.9, color: '#909090', atomicNumber: 6, valenceCount: 4, electronegativity: 2.55, maxBonds: 4,
    meltingPoint: 35.0, boilingPoint: 48.0, // High MP/BP for carbon structures
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 2)]
  },
  [AtomType.Nitrogen]: {
    mass: 14, charge: -3, radius: 0.85, color: '#3050F8', atomicNumber: 7, valenceCount: 5, electronegativity: 3.04, maxBonds: 4,
    meltingPoint: 0.6, boilingPoint: 0.7, // Low for bulk N, but N2 bond is strong (handled by chemistry logic)
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 3)]
  },
  [AtomType.Oxygen]: { 
    mass: 16, charge: -2, radius: 0.8, color: '#FF4136', atomicNumber: 8, valenceCount: 6, electronegativity: 3.44, maxBonds: 2,
    meltingPoint: 0.5, boilingPoint: 0.9,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 4)]
  },
  [AtomType.Fluorine]: {
    mass: 19, charge: -1, radius: 0.7, color: '#90E050', atomicNumber: 9, valenceCount: 7, electronegativity: 3.98, maxBonds: 1,
    meltingPoint: 0.5, boilingPoint: 0.8,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 5)]
  },
  [AtomType.Neon]: {
    mass: 20, charge: 0, radius: 0.6, color: '#B3E3F5', atomicNumber: 10, valenceCount: 8, electronegativity: 0, maxBonds: 0,
    meltingPoint: 0.2, boilingPoint: 0.3,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 6)]
  },
  [AtomType.Sodium]: { 
    mass: 23, charge: 1, radius: 1.1, color: '#AB78FF', atomicNumber: 11, valenceCount: 1, electronegativity: 0.93, maxBonds: 1,
    meltingPoint: 3.7, boilingPoint: 8.8, 
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 6), ...assignOrbitals(3, 's', 1)]
  },
  [AtomType.Phosphorus]: {
    mass: 31, charge: -3, radius: 1.1, color: '#FF8000', atomicNumber: 15, valenceCount: 5, electronegativity: 2.19, maxBonds: 5,
    meltingPoint: 3.1, boilingPoint: 5.5,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 6), ...assignOrbitals(3, 's', 2), ...assignOrbitals(3, 'p', 3)]
  },
  [AtomType.Sulfur]: {
    mass: 32, charge: -2, radius: 1.05, color: '#FFFF30', atomicNumber: 16, valenceCount: 6, electronegativity: 2.58, maxBonds: 6,
    meltingPoint: 3.8, boilingPoint: 7.0,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 6), ...assignOrbitals(3, 's', 2), ...assignOrbitals(3, 'p', 4)]
  },
  [AtomType.Chlorine]: { 
    mass: 35.5, charge: -1, radius: 1.0, color: '#1FF01F', atomicNumber: 17, valenceCount: 7, electronegativity: 3.16, maxBonds: 1,
    meltingPoint: 1.7, boilingPoint: 2.4,
    orbitals: [...assignOrbitals(1, 's', 2), ...assignOrbitals(2, 's', 2), ...assignOrbitals(2, 'p', 6), ...assignOrbitals(3, 's', 2), ...assignOrbitals(3, 'p', 5)]
  },
};

export const MOLECULE_TEMPLATES: Record<string, MoleculeTemplate> = {
  'water': {
    name: 'Water (H2O)',
    atoms: [
      { type: AtomType.Oxygen, offset: new Vector3(0, 0, 0) },
      { type: AtomType.Hydrogen, offset: new Vector3(0.6, 0.4, 0) }, // Tighter packing
      { type: AtomType.Hydrogen, offset: new Vector3(-0.6, 0.4, 0) }
    ],
    bonds: [
      { idxA: 0, idxB: 1, type: 'covalent', order: 1 },
      { idxA: 0, idxB: 2, type: 'covalent', order: 1 }
    ]
  },
  'co2': {
    name: 'Carbon Dioxide (CO2)',
    atoms: [
      { type: AtomType.Carbon, offset: new Vector3(0, 0, 0) },
      { type: AtomType.Oxygen, offset: new Vector3(0.9, 0, 0) }, // Tighter
      { type: AtomType.Oxygen, offset: new Vector3(-0.9, 0, 0) }
    ],
    bonds: [
      { idxA: 0, idxB: 1, type: 'covalent', order: 2 }, 
      { idxA: 0, idxB: 2, type: 'covalent', order: 2 } 
    ]
  },
  'methane': {
    name: 'Methane (CH4)',
    atoms: [
      { type: AtomType.Carbon, offset: new Vector3(0, 0, 0) },
      { type: AtomType.Hydrogen, offset: new Vector3(0.6, 0.6, 0.6) },
      { type: AtomType.Hydrogen, offset: new Vector3(-0.6, -0.6, 0.6) },
      { type: AtomType.Hydrogen, offset: new Vector3(-0.6, 0.6, -0.6) },
      { type: AtomType.Hydrogen, offset: new Vector3(0.6, -0.6, -0.6) }
    ],
    bonds: [
      { idxA: 0, idxB: 1, type: 'covalent', order: 1 },
      { idxA: 0, idxB: 2, type: 'covalent', order: 1 },
      { idxA: 0, idxB: 3, type: 'covalent', order: 1 },
      { idxA: 0, idxB: 4, type: 'covalent', order: 1 }
    ]
  },
  'ethene': {
    name: 'Ethene (C2H4)',
    atoms: [
      { type: AtomType.Carbon, offset: new Vector3(-0.4, 0, 0) }, // Tighter Double Bond
      { type: AtomType.Carbon, offset: new Vector3(0.4, 0, 0) },
      { type: AtomType.Hydrogen, offset: new Vector3(-0.9, 0.7, 0) },
      { type: AtomType.Hydrogen, offset: new Vector3(-0.9, -0.7, 0) },
      { type: AtomType.Hydrogen, offset: new Vector3(0.9, 0.7, 0) },
      { type: AtomType.Hydrogen, offset: new Vector3(0.9, -0.7, 0) },
    ],
    bonds: [
        { idxA: 0, idxB: 1, type: 'covalent', order: 2 }, 
        { idxA: 0, idxB: 2, type: 'covalent', order: 1 },
        { idxA: 0, idxB: 3, type: 'covalent', order: 1 },
        { idxA: 1, idxB: 4, type: 'covalent', order: 1 },
        { idxA: 1, idxB: 5, type: 'covalent', order: 1 },
    ]
  },
  'nitrogen_gas': {
      name: 'Nitrogen (N2)',
      atoms: [
          { type: AtomType.Nitrogen, offset: new Vector3(-0.35, 0, 0) }, // Tighter Triple Bond
          { type: AtomType.Nitrogen, offset: new Vector3(0.35, 0, 0) }
      ],
      bonds: [
          { idxA: 0, idxB: 1, type: 'covalent', order: 3 } 
      ]
  },
  'salt': {
    name: 'Salt (NaCl)',
    atoms: [
      { type: AtomType.Sodium, offset: new Vector3(0, 0, 0) },
      { type: AtomType.Chlorine, offset: new Vector3(1.6, 0, 0) },
      { type: AtomType.Sodium, offset: new Vector3(0, 1.6, 0) },
      { type: AtomType.Chlorine, offset: new Vector3(1.6, 1.6, 0) },
      { type: AtomType.Sodium, offset: new Vector3(1.6, 0, 1.6) },
      { type: AtomType.Chlorine, offset: new Vector3(0, 0, 1.6) }
    ],
    bonds: [
      { idxA: 0, idxB: 1, type: 'ionic', order: 1 },
      { idxA: 2, idxB: 3, type: 'ionic', order: 1 },
      { idxA: 0, idxB: 2, type: 'ionic', order: 1 },
      { idxA: 1, idxB: 3, type: 'ionic', order: 1 },
      { idxA: 0, idxB: 5, type: 'ionic', order: 1 },
      { idxA: 1, idxB: 4, type: 'ionic', order: 1 }
    ]
  }
};

export const generateElectrons = (atomType: AtomType): ElectronState[] => {
  const electrons: ElectronState[] = [];
  const config = ATOM_CONFIGS[atomType].orbitals;
  
  config.forEach((orb, i) => {
       const n = parseInt(orb.type.charAt(0));
       let axis = new Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
       if (orb.type.includes('px')) axis = new Vector3(1, 0, 0);
       if (orb.type.includes('py')) axis = new Vector3(0, 1, 0);
       if (orb.type.includes('pz')) axis = new Vector3(0, 0, 1);

       electrons.push({
         id: uuidv4(),
         type: n === 1 && atomType !== 'H' && atomType !== 'He' ? 'core' : 'valence',
         n: n,
         orbitalType: orb.type,
         spin: i % 2 === 0 ? 1 : -1, 
         phaseOffset: Math.random() * Math.PI * 2,
         axis: axis
       });
  });
  
  return electrons;
};

export const createMoleculeFromTemplate = (key: string, position: Vector3): { atoms: AtomData[]; bonds: BondData[] } => {
  const template = MOLECULE_TEMPLATES[key];
  if (!template) return { atoms: [], bonds: [] };

  const atoms: AtomData[] = [];
  const bonds: BondData[] = [];
  const atomIds: string[] = [];

  // Create Atoms
  template.atoms.forEach(tmplAtom => {
      const id = uuidv4();
      atomIds.push(id);
      const pos = position.clone().add(tmplAtom.offset);
      // NOTE: We rely on default charges from ATOM_CONFIGS unless modified by template context later
      atoms.push({
          id: id,
          type: tmplAtom.type,
          position: pos,
          velocity: new Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2),
          ...ATOM_CONFIGS[tmplAtom.type],
          electrons: generateElectrons(tmplAtom.type)
      });
  });

  // Create Bonds
  template.bonds.forEach(tmplBond => {
      const a1 = atoms[tmplBond.idxA];
      const a2 = atoms[tmplBond.idxB];
      
      // Ionic logic for presets - Overwrite charges for Salt
      if (tmplBond.type === 'ionic') {
          if (a1.type === AtomType.Sodium && a2.type === AtomType.Chlorine) {
              a1.charge = 1;
              a2.charge = -1;
          }
      }
      
      const radiusSum = a1.radius + a2.radius;
      let lengthMult = 0.75; // Default for single
      if (tmplBond.order === 2) lengthMult = 0.65;
      if (tmplBond.order === 3) lengthMult = 0.60;

      bonds.push({
          id: uuidv4(),
          atomA: atomIds[tmplBond.idxA],
          atomB: atomIds[tmplBond.idxB],
          strength: (tmplBond.type === 'ionic' ? BOND_STRENGTH_IONIC : BOND_STRENGTH_COVALENT), 
          restLength: radiusSum * lengthMult, 
          type: tmplBond.type,
          order: tmplBond.order || 1
      });
  });

  return { atoms, bonds };
};

export const createWaterMolecule = (center: Vector3) => createMoleculeFromTemplate('water', center);
export const createSaltLattice = (center: Vector3) => createMoleculeFromTemplate('salt', center);
