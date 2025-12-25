import React, { useState, useEffect } from 'react';
import { Scene } from './components/Scene';
import { SimulationState, AtomData, AtomType, PhotonData, SelectionItem } from './types';
import { createWaterMolecule, createSaltLattice, ATOM_CONFIGS, MOLECULE_TEMPLATES } from './constants';
import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { Atom, Zap, Play, Pause, Thermometer, RotateCcw, Microscope, Beaker, Layers, Magnet, Grid } from 'lucide-react';

const INITIAL_STATE: SimulationState = {
  atoms: [],
  bonds: [],
  photons: [],
  temperature: 3.0, // Start at approx 300K
  isRunning: true,
  timeScale: 1.0,
  magneticField: new Vector3(0, 0, 0),
  showFieldVectors: false,
};

const App: React.FC = () => {
  const [simulationState, setSimulationState] = useState<SimulationState>(INITIAL_STATE);
  const [selection, setSelection] = useState<SelectionItem[]>([]);
  const [showBank, setShowBank] = useState(true);

  const resetSimulation = (type: 'water' | 'salt' | 'dipole') => {
    let newAtoms: any[] = [];
    let newBonds: any[] = [];

    if (type === 'water') {
      const m1 = createWaterMolecule(new Vector3(0, 0, 0));
      const m2 = createWaterMolecule(new Vector3(2.5, 1, 1));
      const m3 = createWaterMolecule(new Vector3(-2, -1, 0.5));
      newAtoms = [...m1.atoms, ...m2.atoms, ...m3.atoms];
      newBonds = [...m1.bonds, ...m2.bonds, ...m3.bonds];
    } else if (type === 'salt') {
      const crystal = createSaltLattice(new Vector3(0, 0, 0));
      newAtoms = crystal.atoms;
      newBonds = crystal.bonds;
    } else if (type === 'dipole') {
        const p1 = {
            id: uuidv4(),
            type: AtomType.Sodium, // Na+
            position: new Vector3(-3, 0, 0),
            velocity: new Vector3(0, 0, 0),
            ...ATOM_CONFIGS[AtomType.Sodium],
            electrons: []
        };
        const p2 = {
            id: uuidv4(),
            type: AtomType.Chlorine, // Cl-
            position: new Vector3(3, 0, 0),
            velocity: new Vector3(0, 0, 0),
            ...ATOM_CONFIGS[AtomType.Chlorine],
            electrons: []
        };
        // Explicitly set charges
        p1.charge = 1;
        p2.charge = -1;
        newAtoms = [p1, p2];
    }

    setSimulationState({
      ...INITIAL_STATE,
      atoms: newAtoms,
      bonds: newBonds,
    });
    setSelection([]);
  };

  const handleFirePhoton = () => {
    const photon: PhotonData = {
      id: uuidv4(),
      position: new Vector3(-10, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
      velocity: new Vector3(1, 0, 0), // Moving right
      energy: 5.0 
    };

    setSimulationState(prev => ({
      ...prev,
      photons: [...prev.photons, photon]
    }));
  };
  
  const togglePlay = () => {
      setSimulationState(s => {
          const newState = !s.isRunning;
          if (newState) setSelection([]); 
          return {...s, isRunning: newState};
      });
  };

  const handleDragStart = (e: React.DragEvent, type: 'atom' | 'molecule', key: string) => {
      e.dataTransfer.setData('application/json', JSON.stringify({ type, key }));
      e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="relative w-full h-screen bg-black text-white font-sans overflow-hidden">
      
      {/* 3D Scene */}
      <Scene 
        simulationState={simulationState} 
        setSimulationState={setSimulationState} 
        selection={selection}
        setSelection={setSelection}
      />

      {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start z-50">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto">
           <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
             Electromagnetic Field Sim
           </h1>
           <p className="text-xs text-gray-400 max-w-[250px]">
             Visualize Electric Fields (Coulomb), Magnetic Forces (Lorentz), and Atomic Interactions.
           </p>
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto">
            {/* Bank Toggle */}
            <button 
                onClick={() => setShowBank(!showBank)} 
                className={`p-3 rounded-xl border ${showBank ? 'bg-purple-600 border-purple-400' : 'bg-black/60 border-white/10'} hover:bg-white/10 transition-colors`}
                title="Element Bank"
            >
                <Beaker className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Element Bank Sidebar */}
      {showBank && (
          <div className="absolute top-20 right-4 w-64 h-[calc(100vh-140px)] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col pointer-events-auto z-40 overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-white/5">
                  <h2 className="font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-purple-400"/> Charged Particles</h2>
                  <p className="text-[10px] text-gray-400 mt-1">Drag charges into the field</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  <div className="mb-4">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Atoms / Ions</h3>
                      <div className="grid grid-cols-2 gap-2">
                          {Object.values(AtomType).map((type) => {
                              const config = ATOM_CONFIGS[type];
                              return (
                                  <div 
                                    key={type}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'atom', type)}
                                    className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2 flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all hover:scale-105"
                                  >
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg" style={{ backgroundColor: config.color, color: '#000' }}>
                                          {type}
                                      </div>
                                      <div className="flex flex-col">
                                          <span className="text-sm font-medium">{type}</span>
                                          <span className="text-[10px] text-gray-400">q: {config.charge}</span>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Presets</h3>
                      <div className="flex flex-col gap-2">
                           <button onClick={() => resetSimulation('dipole')} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-3 flex items-center gap-3 transition-all text-left">
                               <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                   <Magnet className="w-4 h-4 text-blue-300" />
                               </div>
                               <div>
                                   <div className="text-sm font-medium">Electric Dipole</div>
                                   <div className="text-[10px] text-gray-400">Two opposite charges</div>
                               </div>
                           </button>
                          {Object.entries(MOLECULE_TEMPLATES).map(([key, tmpl]) => (
                               <div 
                                    key={key}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'molecule', key)}
                                    className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-3 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all hover:translate-x-1"
                               >
                                   <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                                            <Beaker className="w-4 h-4 text-white/70" />
                                       </div>
                                       <div className="flex flex-col">
                                           <span className="text-sm font-medium">{tmpl.name.split('(')[0]}</span>
                                           <span className="text-[10px] text-gray-400">{tmpl.name.split('(')[1]?.replace(')', '')}</span>
                                       </div>
                                   </div>
                               </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Pause Instruction */}
      {!simulationState.isRunning && (
         <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-30">
            <div className="bg-blue-500/20 border border-blue-400/30 px-6 py-2 rounded-full text-blue-200 text-sm flex items-center gap-2 animate-pulse">
                <Microscope className="w-4 h-4" />
                <span>Paused. Physics engine stopped.</span>
            </div>
         </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-black/70 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-4 shadow-2xl pointer-events-auto z-50">
        
        {/* Main Controls */}
        <div className="flex flex-col md:flex-row w-full gap-6 items-center">
            <div className="flex items-center gap-2">
            <button 
                onClick={togglePlay}
                className={`p-3 rounded-full transition-all ${!simulationState.isRunning ? 'bg-orange-500 hover:bg-orange-400 text-black' : 'bg-white/10 hover:bg-white/20'}`}
            >
                {simulationState.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <button 
                onClick={() => resetSimulation('dipole')}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                title="Reset"
            >
                <RotateCcw className="w-5 h-5" />
            </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Grid className="w-3 h-3"/> E-Field Vis</span>
                        <span className={simulationState.showFieldVectors ? "text-green-400" : "text-gray-500"}>
                            {simulationState.showFieldVectors ? "ON" : "OFF"}
                        </span>
                    </div>
                    <button 
                        onClick={() => setSimulationState(s => ({...s, showFieldVectors: !s.showFieldVectors}))}
                        className={`w-full h-6 rounded text-xs font-bold transition-all ${simulationState.showFieldVectors ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                    >
                        Toggle Field Map
                    </button>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Magnet className="w-3 h-3"/> B-Field (Z-axis)</span>
                        <span>{simulationState.magneticField.z.toFixed(1)} T</span>
                    </div>
                    <input 
                        type="range" min="-5" max="5" step="0.5"
                        value={simulationState.magneticField.z}
                        onChange={(e) => setSimulationState(s => ({...s, magneticField: new Vector3(0, 0, parseFloat(e.target.value))}))}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <div className="flex flex-col gap-1 w-24">
                    <span className="text-[10px] text-gray-400">Temp (K)</span>
                    <input 
                        type="range" min="0" max="10" step="0.1"
                        value={simulationState.temperature}
                        onChange={(e) => setSimulationState(s => ({...s, temperature: parseFloat(e.target.value)}))}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>
            </div>
        </div>
      </div>
      
    </div>
  );
};

export default App;