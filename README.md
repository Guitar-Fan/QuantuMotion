# QuantuMotion - Electromagnetic Particle Simulation

QuantuMotion is an advanced, interactive 3D physics simulation designed to visualize atomic structures, chemical bonds, and electromagnetic interactions in real-time using React Three Fiber.

## Development History

### Version 1.2: Enhanced Physics & Analysis Tools
*   **Physics Engine Tuning:** 
    *   Significantly increased the Coulomb constant (`K=350`) to create "snappier," more noticeable electrostatic attraction and repulsion between ions.
*   **Advanced Interactivity:**
    *   Overhauled the atom selection interface (active during the "Paused" state).
*   **Analytical HUD:**
    *   Implemented a detailed "Interaction Visualization" panel that appears when two atoms are selected.
    *   **Electronegativity (EN):** Displays individual EN values and the difference ($\Delta EN$).
    *   **Bond Prediction:** Automatically classifies potential interactions as **Ionic**, **Polar Covalent**, or **Nonpolar Covalent** based on $\Delta EN$ thresholds.
    *   **Formal Charge:** Displays net charge (e.g., +1, -2) derived from atomic presets and ionization states.
    *   **Forces:** Real-time calculation of electrostatic force magnitude and separation distance.

### Version 1.1: Standalone Optimization
*   **Dependency Cleanup:** 
    *   Removed external AI dependencies (Google Gemini) to ensure the application runs entirely client-side with no API key requirements.
    *   Refactored the `App.tsx` and `metadata.json` to reflect a fully self-contained architecture.
*   **Performance:**
    *   Optimized React Three Fiber rendering loops for smoother particle trajectory updates.

### Version 1.0: Core Engine & Visualization
*   **3D Rendering:** 
    *   Implemented a scene using `@react-three/fiber` and `@react-three/drei`.
    *   Visuals include blooming, vignettes, and instanced mesh rendering for performance.
*   **Atomic Structure:**
    *   **Nucleus:** Rendered based on atomic radius and color conventions (CPK).
    *   **Electrons:** animated orbitals ($s$, $p$, $d$ shells) with real-time spin and phase offsets.
*   **Physics Systems:**
    *   **Coulomb's Law:** Electrostatic attraction/repulsion ($F = k \frac{q_1q_2}{r^2}$).
    *   **Lorentz Force:** Magnetic field interactions ($F = q(v \times B)$).
    *   **Lennard-Jones Potential:** Short-range repulsion to simulate Pauli exclusion (preventing atom fusion).
    *   **Thermodynamics:** Temperature slider controlling kinetic energy and bond stability/breakage probabilities.
*   **Chemistry Engine:**
    *   **Dynamic Bonding:** Atoms automatically form Covalent or Ionic bonds based on proximity, valency availability, and temperature.
    *   **Molecule Templates:** Drag-and-drop system for pre-built structures (Water, Salt Lattice, Methane, etc.).
*   **Field Visualization:**
    *   Toggleable 3D vector field grid visualizing the net electric field at various points in space.

## Tech Stack
*   **Framework:** React 19
*   **3D Engine:** Three.js / React Three Fiber
*   **Styling:** Tailwind CSS
*   **Icons:** Lucide React
