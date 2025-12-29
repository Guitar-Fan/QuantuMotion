# QuantuMotion - Electromagnetic Particle Simulation

QuantuMotion is an interactive 3D physics simulation for visualizing atomic structures, chemical bonds, and electromagnetic interactions in real-time. Built with React Three Fiber, it provides a hands-on environment to explore the microscopic world of particles and fields.

## Features

- **Real-time 3D Visualization**: High-performance rendering of atoms and molecules using Three.js and React Three Fiber, featuring bloom effects and detailed particle trajectories.
- **Atomic Structure**: Detailed representation of atoms including nuclei and animated electron orbitals ($s$, $p$, $d$ shells) with realistic spin and phase offsets.
- **Physics Engine**:
    - **Electrostatics**: Coulomb's Law implementation for attraction and repulsion between charged particles.
    - **Electromagnetism**: Lorentz force simulation for interactions with magnetic fields.
    - **Molecular Dynamics**: Lennard-Jones potential to simulate short-range repulsion and prevent atomic overlap.
    - **Thermodynamics**: Adjustable temperature controls to influence kinetic energy and bond stability.
- **Chemistry Simulation**:
    - **Dynamic Bonding**: Automatic formation of covalent and ionic bonds based on proximity, valency, and energy states.
    - **Bond Physics**: Realistic bond strengths and thermal dissociation models.
    - **Molecule Templates**: Pre-built structures like Water, Salt Lattices, and Methane for immediate exploration.
- **Analytical Tools**:
    - **Interaction Analysis**: Real-time calculation of electronegativity differences, bond types, formal charges, and electrostatic forces.
    - **Field Visualization**: Toggleable 3D vector fields to visualize electric field distributions.
- **Interactive Interface**: Pause and select atoms to inspect properties, manipulate the environment, and observe physical interactions in detail.

## Tech Stack

- **Framework**: React
- **3D Engine**: Three.js / React Three Fiber
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
