import { Vector3 } from 'three';

export enum AtomType {
  Hydrogen = 'H',
  Helium = 'He',
  Lithium = 'Li',
  Beryllium = 'Be',
  Carbon = 'C',
  Nitrogen = 'N',
  Oxygen = 'O',
  Fluorine = 'F',
  Neon = 'Ne',
  Sodium = 'Na',
  Phosphorus = 'P',
  Sulfur = 'S',
  Chlorine = 'Cl',
}

export type OrbitalType = '1s' | '2s' | '2px' | '2py' | '2pz' | '3s' | '3px' | '3py' | '3pz';
export type MatterState = 'Solid' | 'Liquid' | 'Gas' | 'Plasma';

export interface ElectronState {
  id: string;
  type: 'core' | 'valence';
  n: number; 
  orbitalType: OrbitalType; 
  spin: 1 | -1; 
  phaseOffset: number; 
  axis: Vector3; 
}

export interface AtomData {
  id: string;
  type: AtomType;
  position: Vector3;
  velocity: Vector3;
  mass: number; 
  charge: number; 
  atomicNumber: number; 
  valenceCount: number; 
  electronegativity: number;
  radius: number; 
  color: string;
  meltingPoint: number; // Simulation units (0-10)
  boilingPoint: number; // Simulation units (0-10)
  electrons: ElectronState[]; 
}

export interface BondData {
  id: string;
  atomA: string; 
  atomB: string; 
  strength: number; 
  restLength: number; 
  order: 1 | 2 | 3; 
  type: 'covalent' | 'ionic' | 'metallic';
}

export interface PhotonData {
  id: string;
  position: Vector3;
  velocity: Vector3;
  energy: number;
}

export interface SimulationState {
  atoms: AtomData[];
  bonds: BondData[];
  photons: PhotonData[];
  temperature: number; 
  isRunning: boolean;
  timeScale: number;
  magneticField: Vector3; // B-field vector (Tesla-equivalent)
  showFieldVectors: boolean; // Visualize E-field grid
}

export interface SelectionItem {
  id: string;
  type: 'atom' | 'electron';
  atomType?: AtomType;
  position: Vector3; 
  charge: number; 
  electronegativity?: number;
  parentAtomId?: string; 
}

export interface MoleculeTemplate {
  name: string;
  atoms: { type: AtomType; offset: Vector3 }[];
  bonds: { idxA: number; idxB: number; type: 'covalent' | 'ionic'; order?: 1|2|3 }[];
}