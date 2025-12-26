import React, { useRef, useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Trail, Environment, Text, Billboard, Box, Cylinder, Plane, Instance, Instances } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Vector3, Color } from 'three';
import { AtomData, BondData, PhotonData, SimulationState, ElectronState, SelectionItem, AtomType, MatterState, ToolMode } from '../types';
import { K_COULOMB, DAMPING, LJ_EPSILON, LJ_SIGMA_SCALE, ATOM_CONFIGS, ATOM_EMOJIS, BOND_FORM_RADIUS, CONTAINER_SIZE, PROXIMITY_LIMIT, BOND_STRENGTH_COVALENT, BOND_STRENGTH_IONIC, BOND_BREAK_RATIO, THERMAL_EXPANSION_COEFF, FIELD_GRID_SIZE, FIELD_GRID_STEP, generateElectrons, createMoleculeFromTemplate } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// Fix: Augment JSX.IntrinsicElements to include Three.js elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: ThreeElements['group'];
      mesh: ThreeElements['mesh'];
      gridHelper: ThreeElements['gridHelper'];
      instancedMesh: ThreeElements['instancedMesh'];
      coneGeometry: ThreeElements['coneGeometry'];
      meshBasicMaterial: ThreeElements['meshBasicMaterial'];
      arrowHelper: ThreeElements['arrowHelper'];
      sphereGeometry: ThreeElements['sphereGeometry'];
      meshStandardMaterial: ThreeElements['meshStandardMaterial'];
      pointLight: ThreeElements['pointLight'];
      meshPhysicalMaterial: ThreeElements['meshPhysicalMaterial'];
      cylinderGeometry: ThreeElements['cylinderGeometry'];
      ringGeometry: ThreeElements['ringGeometry'];
      circleGeometry: ThreeElements['circleGeometry'];
      ambientLight: ThreeElements['ambientLight'];
      color: ThreeElements['color'];
    }
  }
}

interface SceneContentProps {
  simulationState: SimulationState;
  setSimulationState: React.Dispatch<React.SetStateAction<SimulationState>>;
  selection: SelectionItem[];
  setSelection: React.Dispatch<React.SetStateAction<SelectionItem[]>>;
}

// --- Visual Helpers ---

const ContainerBox = () => {
    return (
        <group>
            <Box args={[CONTAINER_SIZE * 2, CONTAINER_SIZE * 2, CONTAINER_SIZE * 2]}>
                <meshBasicMaterial color="#333333" wireframe />
            </Box>
            <gridHelper args={[CONTAINER_SIZE * 2, 20, 0x444444, 0x111111]} position={[0, -0.1, 0]} />
            <gridHelper args={[CONTAINER_SIZE * 2, 20, 0x333333, 0x111111]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} />
            <gridHelper args={[CONTAINER_SIZE * 2, 20, 0x333333, 0x111111]} rotation={[0, 0, Math.PI / 2]} position={[-0.1, 0, 0]} />
        </group>
    );
};

const VectorField = ({ atoms, visible }: { atoms: AtomData[], visible: boolean }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const count = FIELD_GRID_SIZE * FIELD_GRID_SIZE;

    useFrame(() => {
        if (!meshRef.current || !visible) return;

        let idx = 0;
        const halfSize = (FIELD_GRID_SIZE * FIELD_GRID_STEP) / 2;
        
        for (let x = 0; x < FIELD_GRID_SIZE; x++) {
            for (let y = 0; y < FIELD_GRID_SIZE; y++) {
                const posX = (x * FIELD_GRID_STEP) - halfSize + (FIELD_GRID_STEP/2);
                const posY = (y * FIELD_GRID_STEP) - halfSize + (FIELD_GRID_STEP/2);
                const pos = new Vector3(posX, posY, 0);
                const E = new Vector3(0,0,0);
                for(const atom of atoms) {
                    const rVec = new Vector3().subVectors(pos, atom.position);
                    const rMagSq = rVec.lengthSq();
                    if(rMagSq < 0.1) continue; 
                    const factor = (K_COULOMB * atom.charge) / Math.pow(rMagSq, 1.5);
                    E.add(rVec.multiplyScalar(factor));
                }
                const magnitude = E.length();
                dummy.position.copy(pos);
                if (magnitude > 0.001) {
                    const dir = E.normalize();
                    const quaternion = new THREE.Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
                    dummy.quaternion.copy(quaternion);
                } else {
                    dummy.rotation.set(0,0,0);
                }
                const scale = Math.min(Math.max(magnitude * 0.1, 0.1), 1.5);
                dummy.scale.set(scale * 0.5, scale, scale * 0.5);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(idx, dummy.matrix);
                const intensity = Math.min(magnitude * 0.2, 1.0);
                meshRef.current.setColorAt(idx, new THREE.Color().setHSL(0.6 - intensity * 0.6, 1.0, 0.5));
                idx++;
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} visible={visible}>
            <coneGeometry args={[0.2, 0.8, 8]} />
            <meshBasicMaterial />
        </instancedMesh>
    );
};

const ElectricFieldViz = ({ item1, item2 }: { item1: SelectionItem, item2: SelectionItem }) => {
    const vectors = useMemo(() => {
        const p1 = item1.position;
        const p2 = item2.position;
        const dist = p1.distanceTo(p2);
        const steps = 12; 
        const result = [];
        for(let i=1; i<steps; i++) {
            const t = i/steps;
            const pos = new Vector3().lerpVectors(p1, p2, t);
            const r1Vec = new Vector3().subVectors(pos, p1);
            const r1Mag = r1Vec.length();
            const E1 = r1Vec.normalize().multiplyScalar((K_COULOMB * item1.charge) / (r1Mag * r1Mag + 0.1));
            const r2Vec = new Vector3().subVectors(pos, p2);
            const r2Mag = r2Vec.length();
            const E2 = r2Vec.normalize().multiplyScalar((K_COULOMB * item2.charge) / (r2Mag * r2Mag + 0.1));
            const ENet = new Vector3().addVectors(E1, E2);
            const mag = ENet.length();
            const vizLen = 0.5; 
            if (mag > 0.1) {
                result.push({ pos, dir: ENet.normalize(), len: vizLen, intensity: Math.min(mag / 50, 1.0) });
            }
        }
        return result;
    }, [item1, item2]);
    return (
        <group>
             {vectors.map((v, i) => (
                 <arrowHelper key={i} args={[v.dir, v.pos, v.len, new THREE.Color().setHSL(0.1 + v.intensity * 0.4, 1, 0.5), 0.2, 0.1]} />
             ))}
        </group>
    );
};

// --- Effects Components ---

const BoltSegment = ({ start, end }: { start: Vector3, end: Vector3 }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    useLayoutEffect(() => {
        if (meshRef.current) {
            const height = start.distanceTo(end);
            if (height > 0) {
                meshRef.current.position.copy(start).lerp(end, 0.5);
                meshRef.current.lookAt(end);
                // Cylinder is Y-up. lookAt points Z towards target.
                // Rotate X by 90deg to align Y-axis of cylinder with Z-axis
                meshRef.current.rotateX(Math.PI / 2);
                meshRef.current.scale.set(1, height, 1);
            }
        }
    }, [start, end]);
    return (
        <mesh ref={meshRef}>
            <cylinderGeometry args={[0.2, 0.2, 1, 6]} />
            <meshBasicMaterial color="#ffff00" toneMapped={false} />
        </mesh>
    );
};

const LightningEffect = ({ position, onComplete, funMode }: { position: Vector3, onComplete: () => void, funMode: boolean }) => {
    // Generate points synchronously to avoid empty render frames causing issues with Line components (replaced by custom segments now)
    const points = useMemo(() => {
        const start = new Vector3(position.x + (Math.random()-0.5)*10, 30, position.z + (Math.random()-0.5)*10);
        const end = position;
        const segments = 10;
        const pts = [start];
        for(let i=1; i<=segments; i++) {
            const t = i/segments;
            const p = new Vector3().lerpVectors(start, end, t);
            if (i < segments) {
                // Add jitter
                p.add(new Vector3((Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4));
            }
            pts.push(p);
        }
        return pts;
    }, [position]);

    useEffect(() => {
        const timeout = setTimeout(onComplete, 200);
        return () => clearTimeout(timeout);
    }, [onComplete]);

    return (
        <group>
            {points.map((pt, i) => {
                if (i === points.length - 1) return null;
                return <BoltSegment key={i} start={pt} end={points[i+1]} />;
            })}
            <pointLight position={position} intensity={20} distance={15} color="#ffff00" />
            <mesh position={position}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="white" transparent opacity={0.8} />
            </mesh>
            {funMode && (
                <Billboard position={position.clone().add(new Vector3(0, 3, 0))}>
                     <Text fontSize={3} color="#ffff00" outlineWidth={0.1} outlineColor="black">ZAP!</Text>
                </Billboard>
            )}
        </group>
    );
};

const BlastEffect = ({ position, onComplete, funMode }: { position: Vector3, onComplete: () => void, funMode: boolean }) => {
    const sphereRef = useRef<THREE.Mesh>(null);
    useFrame((_, delta) => {
        if (sphereRef.current) {
            sphereRef.current.scale.addScalar(delta * 40);
            const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity -= delta * 3;
            if (mat.opacity <= 0) onComplete();
        }
    });

    return (
        <group>
            <mesh position={position} ref={sphereRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color="#ff5500" transparent opacity={0.8} />
            </mesh>
             {funMode && (
                <Billboard position={position.clone().add(new Vector3(0, 2, 0))}>
                     <Text fontSize={4} color="#ff0000" outlineWidth={0.1} outlineColor="black">POW!</Text>
                </Billboard>
            )}
        </group>
    );
};

const VortexVisual = ({ position }: { position: Vector3 }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        if (ref.current) {
            ref.current.rotation.z = clock.getElapsedTime() * 5;
            ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 10) * 0.2);
        }
    });
    return (
        <group position={position} ref={ref}>
            <mesh>
                <ringGeometry args={[1, 3, 32]} />
                <meshBasicMaterial color="#a020f0" side={THREE.DoubleSide} transparent opacity={0.4} wireframe />
            </mesh>
            <mesh>
                <sphereGeometry args={[0.5]} />
                <meshBasicMaterial color="black" />
            </mesh>
        </group>
    );
};

const Electron = ({ state, atomRadius, color, atomPos, onSelect, isSelected, funMode }: { state: ElectronState, atomRadius: number, color: string, atomPos: Vector3, onSelect: (e: ThreeEvent<MouseEvent>, elState: ElectronState, pos: Vector3) => void, isSelected: boolean, funMode: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const speed = 4.0 / state.n; 
      const t = clock.getElapsedTime() * speed + state.phaseOffset; 
      let x = 0, y = 0, z = 0;
      if (state.orbitalType.includes('s')) {
        const shellRadius = (atomRadius * 0.5) + (state.n * 0.3);
        x = Math.sin(t) * Math.cos(t * 1.3) * shellRadius;
        y = Math.sin(t * 1.3) * Math.sin(t) * shellRadius;
        z = Math.cos(t) * shellRadius;
      } else if (state.orbitalType.includes('p')) {
        const lobeSize = (atomRadius * 0.8) + (state.n * 0.2);
        const wobble = Math.sin(t * 2) * 0.2; 
        if (state.orbitalType.includes('x')) { x = Math.sin(t) * lobeSize; y = Math.cos(t * 2) * 0.3; z = wobble; } 
        else if (state.orbitalType.includes('y')) { x = wobble; y = Math.sin(t) * lobeSize; z = Math.cos(t * 2) * 0.3; } 
        else if (state.orbitalType.includes('z')) { x = Math.cos(t * 2) * 0.3; y = wobble; z = Math.sin(t) * lobeSize; }
      }
      meshRef.current.position.set(x, y, z);
    }
  });
  const displayColor = state.type === 'core' ? '#444444' : color;
  const size = state.type === 'core' ? 0.04 : 0.05;

  return (
    <group>
      {!funMode && state.type === 'valence' && (
        <Trail width={0.1} length={3} color={color} attenuation={(t) => t * t}> <mesh position={[0,0,0]} /> </Trail>
      )}
      {funMode ? (
        <group ref={meshRef} onClick={(e) => { const worldPos = new Vector3(); e.object.getWorldPosition(worldPos); onSelect(e, state, worldPos); }}>
             <Billboard> <Text fontSize={0.2} anchorX="center" anchorY="middle">🐝</Text> </Billboard>
        </group>
      ) : (
        <mesh ref={meshRef} onClick={(e) => { const worldPos = new Vector3(); e.object.getWorldPosition(worldPos); onSelect(e, state, worldPos); }}
            onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'default'}>
            <sphereGeometry args={[size, 8, 8]} />
            <meshBasicMaterial color={isSelected ? '#ffff00' : displayColor} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

const Nucleus = ({ atom, activeBondCount, activeBondOrders, isSelected, onSelect, onElectronSelect, selectedElectronIds, simTemp, funMode }: { atom: AtomData; activeBondCount: number; activeBondOrders: number; isSelected: boolean; onSelect: (atom: AtomData) => void; onElectronSelect: (e: ThreeEvent<MouseEvent>, el: ElectronState, pos: Vector3) => void; selectedElectronIds: string[]; simTemp: number; funMode: boolean; }) => {
  const groupRef = useRef<THREE.Group>(null);
  let phase: MatterState = 'Liquid';
  if (simTemp < atom.meltingPoint) phase = 'Solid';
  else if (simTemp > atom.boilingPoint) phase = 'Gas';
  if (simTemp > 20.0) phase = 'Plasma';
  const formalCharge = atom.charge;
  const fcText = formalCharge > 0 ? `+${formalCharge}` : (formalCharge < 0 ? `${formalCharge}` : '');
  useFrame(() => { if (groupRef.current) groupRef.current.position.copy(atom.position); });

  return (
    <group ref={groupRef}>
      <group onClick={(e) => { e.stopPropagation(); onSelect(atom); }}>
        {funMode ? (
            <Billboard> <Text fontSize={atom.radius * 2.5} anchorX="center" anchorY="middle"> {ATOM_EMOJIS[atom.type] || '⚫'} </Text> </Billboard>
        ) : (
            <>
                <Sphere args={[0.25, 16, 16]}> <meshStandardMaterial color={atom.color} emissive={isSelected ? '#ffffff' : atom.color} emissiveIntensity={isSelected ? 1.0 : 0.5} roughness={0.1} /> </Sphere>
                <pointLight color={atom.color} distance={4} intensity={1.5} decay={2} />
            </>
        )}
        <Billboard position={[0, 0.7, 0]} follow={true}>
            <group>
                <Text fontSize={0.25} color="#ffffff" outlineWidth={0.02} outlineColor="#000000" anchorY="bottom"> {atom.type} </Text>
                {fcText && ( <Text position={[0.4, 0.1, 0]} fontSize={0.2} color={formalCharge > 0 ? '#55ff55' : '#ff5555'} outlineWidth={0.02} outlineColor="black"> {fcText} </Text> )}
                <Text position={[0, -0.3, 0]} fontSize={0.15} color={phase === 'Solid' ? '#aaaaff' : (phase === 'Gas' ? '#ffaaaa' : '#ffffff')}> {phase} </Text>
            </group>
        </Billboard>
      </group>
      {atom.electrons.map((e) => (
        <Electron key={e.id} state={e} atomRadius={atom.radius} color={atom.color} atomPos={atom.position} onSelect={onElectronSelect} isSelected={selectedElectronIds.includes(e.id)} funMode={funMode} />
      ))}
      {!funMode && (
        <Sphere args={[atom.radius, 32, 32]}> <meshPhysicalMaterial color={atom.color} transparent opacity={0.03} roughness={0} transmission={0.9} depthWrite={false} side={THREE.DoubleSide} /> </Sphere>
      )}
    </group>
  );
};

const BondMesh = ({ bond, atomA, atomB }: { bond: BondData; atomA: AtomData; atomB: AtomData }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      const start = atomA.position;
      const end = atomB.position;
      const dist = start.distanceTo(end);
      meshRef.current.position.lerpVectors(start, end, 0.5);
      meshRef.current.lookAt(end);
      meshRef.current.rotateX(Math.PI / 2);
      meshRef.current.scale.set(1, dist, 1);
    }
  });
  const isIonic = bond.type === 'ionic';
  const color = isIonic ? '#ffff00' : (bond.type === 'covalent' ? '#ffffff' : '#aaaaff');
  const opacity = isIonic ? 0.15 : 0.3;
  return (
    <group ref={meshRef}>
        <mesh> <cylinderGeometry args={[0.04, 0.04, 1, 8, 1, true]} /> <meshPhysicalMaterial color={color} transparent opacity={opacity} emissive={color} emissiveIntensity={0.2} side={THREE.DoubleSide} wireframe={isIonic} /> </mesh>
        {bond.order >= 2 && ( <mesh position={[0.08, 0, 0]}> <cylinderGeometry args={[0.02, 0.02, 0.9, 8, 1, true]} /> <meshPhysicalMaterial color="#ff00ff" transparent opacity={0.4} emissive="#ff00ff" emissiveIntensity={0.5} /> </mesh> )}
        {bond.order >= 2 && ( <mesh position={[-0.08, 0, 0]}> <cylinderGeometry args={[0.02, 0.02, 0.9, 8, 1, true]} /> <meshPhysicalMaterial color="#ff00ff" transparent opacity={0.4} emissive="#ff00ff" emissiveIntensity={0.5} /> </mesh> )}
        {bond.order >= 3 && ( <mesh position={[0, 0, 0.08]}> <cylinderGeometry args={[0.02, 0.02, 0.9, 8, 1, true]} /> <meshPhysicalMaterial color="#00ffff" transparent opacity={0.4} emissive="#00ffff" emissiveIntensity={0.5} /> </mesh> )}
        {bond.order >= 3 && ( <mesh position={[0, 0, -0.08]}> <cylinderGeometry args={[0.02, 0.02, 0.9, 8, 1, true]} /> <meshPhysicalMaterial color="#00ffff" transparent opacity={0.4} emissive="#00ffff" emissiveIntensity={0.5} /> </mesh> )}
    </group>
  );
};

const DropHandler = ({ stateRef, setSimulationState }: { stateRef: React.MutableRefObject<SimulationState>, setSimulationState: React.Dispatch<React.SetStateAction<SimulationState>> }) => {
  const { camera, gl } = useThree();
  const [isHovering, setIsHovering] = useState(false);
  const reticleRef = useRef<THREE.Mesh>(null);
  const getCenterOfMass = (): Vector3 => {
      const atoms = stateRef.current.atoms;
      if (atoms.length === 0) return new Vector3(0,0,0);
      const com = new Vector3();
      atoms.forEach(a => com.add(a.position));
      return com.divideScalar(atoms.length);
  };
  const getClosestAtom = (point: Vector3): { atom: AtomData | null, dist: number } => {
      const atoms = stateRef.current.atoms;
      if (atoms.length === 0) return { atom: null, dist: Infinity };
      let closest = atoms[0];
      let minDst = point.distanceTo(atoms[0].position);
      for(let i=1; i<atoms.length; i++) {
          const d = point.distanceTo(atoms[i].position);
          if (d < minDst) { minDst = d; closest = atoms[i]; }
      }
      return { atom: closest, dist: minDst };
  };
  useEffect(() => {
    const calculateSpawnPos = (clientX: number, clientY: number): Vector3 => {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;
        const vector = new Vector3(x, y, 0.5);
        vector.unproject(camera);
        const rayDir = vector.sub(camera.position).normalize();
        const com = getCenterOfMass();
        const planeNormal = new Vector3();
        camera.getWorldDirection(planeNormal);
        planeNormal.normalize();
        const denom = rayDir.dot(planeNormal);
        if (Math.abs(denom) < 0.0001) return new Vector3(0,0,0);
        const t = com.clone().sub(camera.position).dot(planeNormal) / denom;
        const intersectPoint = camera.position.clone().add(rayDir.multiplyScalar(t));
        const { atom, dist } = getClosestAtom(intersectPoint);
        if (atom && dist > PROXIMITY_LIMIT) {
             const dirToAtom = intersectPoint.clone().sub(atom.position).normalize();
             intersectPoint.copy(atom.position).add(dirToAtom.multiplyScalar(PROXIMITY_LIMIT));
        }
        intersectPoint.x = Math.max(-CONTAINER_SIZE + 2, Math.min(CONTAINER_SIZE - 2, intersectPoint.x));
        intersectPoint.y = Math.max(-CONTAINER_SIZE + 2, Math.min(CONTAINER_SIZE - 2, intersectPoint.y));
        intersectPoint.z = Math.max(-CONTAINER_SIZE + 2, Math.min(CONTAINER_SIZE - 2, intersectPoint.z));
        return intersectPoint;
    };
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault(); 
      setIsHovering(true);
      if (reticleRef.current) {
          const pos = calculateSpawnPos(event.clientX, event.clientY);
          reticleRef.current.position.copy(pos);
          reticleRef.current.lookAt(camera.position); 
      }
    };
    const handleDragLeave = (event: DragEvent) => {
        if (event.target === gl.domElement) setIsHovering(false);
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsHovering(false);
      const dataString = event.dataTransfer?.getData('application/json');
      if (!dataString) return;
      try {
        const data = JSON.parse(dataString);
        const spawnPos = calculateSpawnPos(event.clientX, event.clientY);
        if (data.type === 'atom') {
           const type = data.key as AtomType;
           const newAtom: AtomData = {
              id: uuidv4(),
              type: type,
              position: spawnPos,
              velocity: new Vector3(0,0,0),
              ...ATOM_CONFIGS[type],
              electrons: generateElectrons(type)
           };
           setSimulationState(prev => ({ ...prev, atoms: [...prev.atoms, newAtom] }));
        } else if (data.type === 'molecule') {
           const molecule = createMoleculeFromTemplate(data.key, spawnPos);
           setSimulationState(prev => ({ ...prev, atoms: [...prev.atoms, ...molecule.atoms], bonds: [...prev.bonds, ...molecule.bonds] }));
        }
      } catch (e) { console.error("Drop failed", e); }
    };
    const canvasEl = gl.domElement;
    canvasEl.addEventListener('drop', handleDrop);
    canvasEl.addEventListener('dragover', handleDragOver);
    canvasEl.addEventListener('dragleave', handleDragLeave);
    return () => {
        canvasEl.removeEventListener('drop', handleDrop);
        canvasEl.removeEventListener('dragover', handleDragOver);
        canvasEl.removeEventListener('dragleave', handleDragLeave);
    };
  }, [camera, gl, setSimulationState, stateRef]);

  return (
    <>
      {isHovering && (
        <group>
            <mesh ref={reticleRef}>
                <ringGeometry args={[0.8, 1.0, 32]} />
                <meshBasicMaterial color="#00ff00" transparent opacity={0.8} side={THREE.DoubleSide} />
                <mesh> <circleGeometry args={[0.1, 16]} /> <meshBasicMaterial color="#00ff00" /> </mesh>
            </mesh>
        </group>
      )}
    </>
  );
};

const InteractionViz = ({ item1, item2 }: { item1: SelectionItem, item2: SelectionItem }) => {
    const start = item1.position;
    const end = item2.position;
    const dist = start.distanceTo(end);
    const force = (K_COULOMB * Math.abs(item1.charge * item2.charge)) / (dist * dist);
    const mid = new Vector3().lerpVectors(start, end, 0.5);
    const deltaEN = item1.electronegativity !== undefined && item2.electronegativity !== undefined ? Math.abs(item1.electronegativity - item2.electronegativity) : null;
    let bondType = '';
    if (deltaEN !== null) {
        if (deltaEN > 1.7) bondType = 'Ionic'; else if (deltaEN > 0.4) bondType = 'Polar Cov.'; else bondType = 'Nonpolar Cov.';
    }
    const fmtCharge = (q: number) => q > 0 ? `+${q}` : (q < 0 ? `${q}` : '0');
    return (
        <group>
            <Line points={[start, end]} color="#00ffff" lineWidth={2} dashed dashScale={2} />
            <Billboard position={mid} follow={true}>
                <group position={[0, 1.5, 0]}>
                    <mesh position={[0, 0, -0.01]}> <planeGeometry args={[5, 3.5]} /> <meshBasicMaterial color="black" transparent opacity={0.7} side={THREE.DoubleSide} /> </mesh>
                    <mesh position={[0, 0, -0.02]}> <planeGeometry args={[5.1, 3.6]} /> <meshBasicMaterial color="#00ffff" transparent opacity={0.3} side={THREE.DoubleSide} /> </mesh>
                    <Text position={[0, 1.2, 0]} fontSize={0.35} color="#00ffff" anchorY="top"> {`F = ${force.toFixed(1)} N`} </Text>
                    <Text position={[0, 0.8, 0]} fontSize={0.25} color="#cccccc" anchorY="top"> {`r = ${dist.toFixed(2)} Å`} </Text>
                    {deltaEN !== null && ( <group position={[0, 0.3, 0]}> <Text fontSize={0.3} color="#ffff00" anchorY="top"> {`ΔEN = ${deltaEN.toFixed(2)}`} </Text> <Text position={[0, -0.35, 0]} fontSize={0.2} color="#aaaaff" anchorY="top"> {`(${bondType})`} </Text> </group> )}
                    <group position={[0, -0.8, 0]}>
                         <Text position={[-1.2, 0, 0]} fontSize={0.22} color="white" anchorX="center"> {item1.atomType || (item1.type === 'electron' ? 'e-' : '?')} </Text>
                         <Text position={[-1.2, -0.3, 0]} fontSize={0.18} color={item1.charge > 0 ? '#55ff55' : '#ff5555'} anchorX="center"> {`q: ${fmtCharge(item1.charge)}`} </Text>
                         {item1.electronegativity !== undefined && ( <Text position={[-1.2, -0.6, 0]} fontSize={0.18} color="#cccccc" anchorX="center"> {`EN: ${item1.electronegativity.toFixed(2)}`} </Text> )}
                         <mesh position={[0, -0.3, 0]}> <planeGeometry args={[0.02, 1]} /> <meshBasicMaterial color="#444444" /> </mesh>
                         <Text position={[1.2, 0, 0]} fontSize={0.22} color="white" anchorX="center"> {item2.atomType || (item2.type === 'electron' ? 'e-' : '?')} </Text>
                         <Text position={[1.2, -0.3, 0]} fontSize={0.18} color={item2.charge > 0 ? '#55ff55' : '#ff5555'} anchorX="center"> {`q: ${fmtCharge(item2.charge)}`} </Text>
                         {item2.electronegativity !== undefined && ( <Text position={[1.2, -0.6, 0]} fontSize={0.18} color="#cccccc" anchorX="center"> {`EN: ${item2.electronegativity.toFixed(2)}`} </Text> )}
                    </group>
                </group>
            </Billboard>
            <mesh position={mid} lookAt={end}> <coneGeometry args={[0.1, 0.3, 8]} /> <meshBasicMaterial color="#00ffff" /> </mesh>
            <ElectricFieldViz item1={item1} item2={item2} />
        </group>
    );
};

// --- Scene Content Main ---

const SceneContent: React.FC<SceneContentProps> = ({ 
    simulationState, 
    setSimulationState,
    selection,
    setSelection
}) => {
  const stateRef = useRef(simulationState);
  const chemistryCooldown = useRef(0);
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  
  // Effects State
  const [effects, setEffects] = useState<{ id: string, type: 'lightning' | 'blast', position: Vector3 }[]>([]);
  const [vortexPos, setVortexPos] = useState<Vector3 | null>(null);

  useEffect(() => {
    stateRef.current = simulationState;
  }, [simulationState]);

  useEffect(() => {
      // Disable orbit controls when using tools that require dragging
      if (controlsRef.current) {
          controlsRef.current.enabled = simulationState.activeTool === 'cursor';
      }
  }, [simulationState.activeTool]);

  useEffect(() => {
    if (controlsRef.current) {
        controlsRef.current.minDistance = 5;
        controlsRef.current.maxDistance = 150;
    }
  }, []);

  const handleNucleusSelect = (atom: AtomData) => {
    if (simulationState.activeTool !== 'cursor') return;
    if (simulationState.isRunning) return;
    setSelection(prev => {
        const isSelected = prev.find(item => item.id === atom.id);
        if (isSelected) return prev.filter(item => item.id !== atom.id);
        const newItem: SelectionItem = { 
            id: atom.id, 
            type: 'atom',
            atomType: atom.type,
            position: atom.position.clone(), 
            charge: atom.charge,
            electronegativity: atom.electronegativity
        };
        if (prev.length >= 2) return [prev[1], newItem];
        return [...prev, newItem];
    });
  };

  const handleElectronSelect = (e: ThreeEvent<MouseEvent>, el: ElectronState, worldPos: Vector3) => {
    e.stopPropagation();
    if (simulationState.activeTool !== 'cursor') return;
    if (simulationState.isRunning) return;
    setSelection(prev => {
        const isSelected = prev.find(item => item.id === el.id);
        if (isSelected) return prev.filter(item => item.id !== el.id);
        const newItem: SelectionItem = { 
            id: el.id, 
            type: 'electron', 
            position: worldPos, 
            charge: -1,
        };
        if (prev.length >= 2) return [prev[1], newItem];
        return [...prev, newItem];
    });
  };

  // Tool Interaction
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
      if (simulationState.activeTool === 'cursor') return;
      e.stopPropagation();
      
      const point = (e as any).point;
      
      if (simulationState.activeTool === 'lightning') {
          // Trigger visual
          const id = uuidv4();
          setEffects(prev => [...prev, { id, type: 'lightning', position: point }]);
          
          // Physics: Sever bonds nearby and heat up atoms
          setSimulationState(prev => {
             const radius = 8.0;
             const atoms = [...prev.atoms];
             let bonds = [...prev.bonds];
             
             // Find affected atoms
             const affectedAtomIds = new Set<string>();
             atoms.forEach(a => {
                 if (a.position.distanceTo(point) < radius) {
                     affectedAtomIds.add(a.id);
                     // Add intense kinetic energy (Heat)
                     a.velocity.add(new Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize().multiplyScalar(10));
                     // Randomly ionize
                     if (Math.random() > 0.5) a.charge += 1;
                 }
             });
             
             // Break bonds connected to affected atoms
             bonds = bonds.filter(b => !affectedAtomIds.has(b.atomA) && !affectedAtomIds.has(b.atomB));
             
             return { ...prev, atoms, bonds, temperature: prev.temperature + 0.5 };
          });
      } else if (simulationState.activeTool === 'blast') {
          const id = uuidv4();
          setEffects(prev => [...prev, { id, type: 'blast', position: point }]);
          
          // Physics: Impulse force away from point
           setSimulationState(prev => {
             const atoms = [...prev.atoms];
             const radius = 15.0;
             atoms.forEach(a => {
                 const dist = a.position.distanceTo(point);
                 if (dist < radius) {
                     const dir = new Vector3().subVectors(a.position, point).normalize();
                     const force = (1.0 - dist/radius) * 40.0; // Strong impulse
                     a.velocity.add(dir.multiplyScalar(force));
                 }
             });
             return { ...prev, atoms };
          });
      } else if (simulationState.activeTool === 'vortex') {
          setVortexPos(point);
      }
  };

  const handlePointerUp = () => {
      if (simulationState.activeTool === 'vortex') {
          setVortexPos(null);
      }
  };
  
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
      if (simulationState.activeTool === 'vortex' && vortexPos) {
          setVortexPos((e as any).point);
      }
  }

  useFrame((state, delta) => {
    if (!stateRef.current.isRunning) return;

    const dt = Math.min(delta, 0.05) * stateRef.current.timeScale;
    const atoms = stateRef.current.atoms;
    const bonds = stateRef.current.bonds;
    let photons = stateRef.current.photons;
    const temp = stateRef.current.temperature;
    const B_field = stateRef.current.magneticField; 

    const forces = new Map<string, Vector3>();
    atoms.forEach(a => forces.set(a.id, new Vector3(0, 0, 0)));

    // Vortex Physics Force
    if (vortexPos) {
        atoms.forEach(a => {
            const dir = new Vector3().subVectors(vortexPos, a.position);
            const dist = dir.length();
            if (dist > 1.0) {
                dir.normalize();
                // Spiral force
                const tangent = new Vector3(-dir.y, dir.x, 0).multiplyScalar(20.0);
                const attraction = dir.multiplyScalar(100.0); // Strong suck
                forces.get(a.id)!.add(attraction).add(tangent);
            }
        });
    }

    // Physics Loop
    for (let i = 0; i < atoms.length; i++) {
      if (B_field.lengthSq() > 0 && atoms[i].charge !== 0) {
           const v = atoms[i].velocity;
           const F_mag = new Vector3().crossVectors(v, B_field).multiplyScalar(atoms[i].charge * 2.0);
           forces.get(atoms[i].id)!.add(F_mag);
      }

      for (let j = i + 1; j < atoms.length; j++) {
        const a1 = atoms[i];
        const a2 = atoms[j];
        const dir = new Vector3().subVectors(a1.position, a2.position);
        const r = dir.length();
        if (r < 0.1) continue;
        dir.normalize();

        const isBonded = bonds.some(b => (b.atomA === a1.id && b.atomB === a2.id) || (b.atomA === a2.id && b.atomB === a1.id));
        let forceMag = 0;

        if (!isBonded) {
          const sigma = (a1.radius + a2.radius) * LJ_SIGMA_SCALE;
          const sr = sigma / r;
          const sr6 = Math.pow(sr, 6);
          const sr12 = sr6 * sr6;
          forceMag += (24 * LJ_EPSILON / r) * (2 * sr12 - sr6);
        }

        if (a1.charge !== 0 && a2.charge !== 0) {
            forceMag += (K_COULOMB * a1.charge * a2.charge) / (r * r);
        }

        if (!isBonded) {
             const meanMP = (a1.meltingPoint + a2.meltingPoint) / 2;
             const meanBP = (a1.boilingPoint + a2.boilingPoint) / 2;
             if (temp < meanBP && r < 4.0) {
                 forceMag -= 15.0 / (r*r);
             }
        }
        const fVec = dir.multiplyScalar(forceMag);
        forces.get(a1.id)!.add(fVec);
        forces.get(a2.id)!.sub(fVec);
      }
    }

    const activeBonds = bonds.filter(bond => {
        const a1 = atoms.find(a => a.id === bond.atomA);
        const a2 = atoms.find(a => a.id === bond.atomB);
        if (!a1 || !a2) return false;
        
        const expansionFactor = 1.0 + (temp * THERMAL_EXPANSION_COEFF);
        const effectiveRestLength = bond.restLength * expansionFactor;
        const dist = a1.position.distanceTo(a2.position);

        // Mechanical failure (safety snap if simulation blows up)
        if (dist > effectiveRestLength * BOND_BREAK_RATIO) return false; 
        
        // Thermal Dissociation Probabilistic Model
        // Bond Energy approx ~ Strength * Order. Temp scales energy check.
        const bondEnergy = bond.strength * bond.order; 
        const thermalEnergy = temp * 150; // Calibrated for new temp scale 0-50
        
        if (thermalEnergy > bondEnergy * 0.8) {
             // Probability increases as Temp exceeds Bond Energy
             const prob = (thermalEnergy - bondEnergy * 0.8) * 0.00005;
             if (Math.random() < prob) return false;
        }

        const dir = new Vector3().subVectors(a2.position, a1.position).normalize();
        const displacement = dist - effectiveRestLength;
        
        // Non-linear stiffness: Double bonds are more than 2x rigid
        const stiffness = bond.strength * Math.pow(bond.order, 1.2); 
        const springForce = dir.multiplyScalar(stiffness * displacement);
        
        forces.get(a1.id)!.add(springForce);
        forces.get(a2.id)!.sub(springForce);
        return true;
    });

    // Chemistry Engine
    chemistryCooldown.current -= dt;
    let structureChanged = false;
    let newBonds = [...activeBonds];

    if (chemistryCooldown.current <= 0) {
        chemistryCooldown.current = 0.2; 
        for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
                const a1 = atoms[i];
                const a2 = atoms[j];
                const configA = ATOM_CONFIGS[a1.type];
                const configB = ATOM_CONFIGS[a2.type];
                if (configA.maxBonds === 0 || configB.maxBonds === 0) continue;
                const currentBondsA = newBonds.filter(b => b.atomA === a1.id || b.atomB === a1.id).length;
                const currentBondsB = newBonds.filter(b => b.atomA === a2.id || b.atomB === a2.id).length;
                if (currentBondsA >= configA.maxBonds || currentBondsB >= configB.maxBonds) continue;
                const existingBondIndex = newBonds.findIndex(b => (b.atomA === a1.id && b.atomB === a2.id) || (b.atomA === a2.id && b.atomB === a1.id));
                const existingBond = existingBondIndex !== -1 ? newBonds[existingBondIndex] : null;
                const dist = a1.position.distanceTo(a2.position);
                const formDist = (a1.radius + a2.radius) * BOND_FORM_RADIUS;
                
                if (!existingBond && dist < formDist) {
                    const meanMP = (a1.meltingPoint + a2.meltingPoint) / 2;
                    const deltaEN = Math.abs(configA.electronegativity - configB.electronegativity);
                    const isIonic = deltaEN > 1.7;
                    const radiusSum = a1.radius + a2.radius;
                    
                    if (isIonic && temp < meanMP) {
                         const donor = configA.electronegativity < configB.electronegativity ? a1 : a2;
                         const acceptor = donor === a1 ? a2 : a1;
                         donor.charge = 1; acceptor.charge = -1;
                         newBonds.push({ id: uuidv4(), atomA: a1.id, atomB: a2.id, strength: BOND_STRENGTH_IONIC, restLength: radiusSum * 0.75, type: 'ionic', order: 1 });
                         structureChanged = true;
                    } 
                    else if (!isIonic && temp < meanMP * 1.5) {
                        newBonds.push({ id: uuidv4(), atomA: a1.id, atomB: a2.id, strength: BOND_STRENGTH_COVALENT, restLength: radiusSum * 0.75, type: 'covalent', order: 1 });
                        structureChanged = true;
                    }
                } 
            }
        }
    }

    // Photon Logic
    const survivingPhotons: PhotonData[] = [];
    photons.forEach(p => {
        p.position.add(p.velocity.clone().multiplyScalar(dt * 15));
        let hit = false;
        for (const bond of newBonds) {
             const a1 = atoms.find(a => a.id === bond.atomA);
             const a2 = atoms.find(a => a.id === bond.atomB);
             if(!a1 || !a2) continue;
             const center = new Vector3().addVectors(a1.position, a2.position).multiplyScalar(0.5);
             if (p.position.distanceTo(center) < 0.8) {
                 newBonds = newBonds.filter(b => b.id !== bond.id);
                 structureChanged = true;
                 const splitDir = new Vector3().subVectors(a1.position, a2.position).normalize();
                 const energy = p.energy * 500;
                 forces.get(a1.id)!.add(splitDir.multiplyScalar(energy));
                 forces.get(a2.id)!.sub(splitDir.multiplyScalar(energy));
                 hit = true; break; 
             }
        }
        if (!hit && p.position.length() < 60) survivingPhotons.push(p);
    });

    atoms.forEach(atom => {
        const f = forces.get(atom.id)!;
        let effectiveDamping = DAMPING;
        let noiseScale = 15;
        if (temp < atom.meltingPoint) { effectiveDamping = 0.90; noiseScale = 5; } else if (temp > atom.boilingPoint) { effectiveDamping = 0.99; noiseScale = 30; }
        const noise = new Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(temp * noiseScale);
        f.add(noise);
        const accel = f.divideScalar(atom.mass);
        atom.velocity.add(accel.multiplyScalar(dt));
        atom.velocity.multiplyScalar(effectiveDamping); 
        atom.position.add(atom.velocity.clone().multiplyScalar(dt));
        if (Math.abs(atom.position.x) > CONTAINER_SIZE) { atom.position.x = Math.sign(atom.position.x) * CONTAINER_SIZE; atom.velocity.x *= -0.5; }
        if (Math.abs(atom.position.y) > CONTAINER_SIZE) { atom.position.y = Math.sign(atom.position.y) * CONTAINER_SIZE; atom.velocity.y *= -0.5; }
        if (Math.abs(atom.position.z) > CONTAINER_SIZE) { atom.position.z = Math.sign(atom.position.z) * CONTAINER_SIZE; atom.velocity.z *= -0.5; }
    });

    if (activeBonds.length !== newBonds.length || survivingPhotons.length !== photons.length || structureChanged) {
         setSimulationState(prev => ({ ...prev, atoms: [...atoms], bonds: newBonds, photons: survivingPhotons }));
    } else {
       stateRef.current.photons = survivingPhotons;
    }
  });

  return (
    <>
      <color attach="background" args={['#030303']} />
      <ambientLight intensity={0.1} />
      <pointLight position={[20, 20, 20]} intensity={0.5} />
      
      {/* Invisible Plane for Tool Interactions */}
      <mesh visible={false} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerMove={handlePointerMove}>
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial />
      </mesh>

      <ContainerBox />
      <DropHandler stateRef={stateRef} setSimulationState={setSimulationState} />
      
      {/* Interactive Tool Effects */}
      {effects.map(effect => (
          effect.type === 'lightning' ? (
              <LightningEffect 
                key={effect.id} 
                position={effect.position} 
                onComplete={() => setEffects(p => p.filter(e => e.id !== effect.id))} 
                funMode={stateRef.current.funMode}
              />
          ) : (
              <BlastEffect 
                key={effect.id} 
                position={effect.position} 
                onComplete={() => setEffects(p => p.filter(e => e.id !== effect.id))} 
                funMode={stateRef.current.funMode}
              />
          )
      ))}
      {vortexPos && <VortexVisual position={vortexPos} />}

      <VectorField atoms={stateRef.current.atoms} visible={stateRef.current.showFieldVectors} />

      {stateRef.current.atoms.map((atom) => {
        const atomBonds = stateRef.current.bonds.filter(b => b.atomA === atom.id || b.atomB === atom.id);
        const activeBondCount = atomBonds.length;
        const activeBondOrders = atomBonds.reduce((s,b) => s + b.order, 0);

        return (
            <Nucleus 
                key={atom.id} 
                atom={atom} 
                activeBondCount={activeBondCount}
                activeBondOrders={activeBondOrders}
                isSelected={selection.some(s => s.id === atom.id)}
                onSelect={handleNucleusSelect}
                onElectronSelect={handleElectronSelect}
                selectedElectronIds={selection.filter(s => s.type === 'electron').map(s => s.id)}
                simTemp={stateRef.current.temperature}
                funMode={stateRef.current.funMode}
            />
        );
      })}

      {stateRef.current.bonds.map((bond) => {
        const a1 = stateRef.current.atoms.find(a => a.id === bond.atomA);
        const a2 = stateRef.current.atoms.find(a => a.id === bond.atomB);
        if (!a1 || !a2) return null;
        return <BondMesh key={bond.id} bond={bond} atomA={a1} atomB={a2} />;
      })}
      
      {selection.length === 2 && (
          <InteractionViz item1={selection[0]} item2={selection[1]} />
      )}

      <EffectComposer>
        <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.2} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
      <OrbitControls ref={controlsRef} makeDefault />
    </>
  );
};

export const Scene = (props: SceneContentProps) => {
  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 80], fov: 45 }} dpr={[1, 2]}>
         <SceneContent {...props} />
      </Canvas>
    </div>
  );
};