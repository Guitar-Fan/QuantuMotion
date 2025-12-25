import { GoogleGenAI } from "@google/genai";
import { SimulationState, AtomType } from "../types";

const initGenAI = () => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const explainSimulation = async (
  state: SimulationState, 
  userQuery: string = "Explain what is happening in this simulation."
): Promise<string> => {
  const ai = initGenAI();
  if (!ai) return "API Key not configured. Please set API_KEY in env.";

  // Summarize state for AI
  const atomCounts = state.atoms.reduce((acc, atom) => {
    acc[atom.type] = (acc[atom.type] || 0) + 1;
    return acc;
  }, {} as Record<AtomType, number>);

  const bondCount = state.bonds.length;
  const photonCount = state.photons.length;

  const context = `
    Current Simulation State:
    - Temperature: ${state.temperature.toFixed(2)} units (Controls kinetic energy)
    - Atoms: ${JSON.stringify(atomCounts)}
    - Active Chemical Bonds: ${bondCount}
    - Active Photons: ${photonCount}
    
    The user is viewing a 3D real-time physics simulation of these particles.
    Forces active: Coulomb electrostatic forces, Covalent/Ionic bond spring forces, and Photon energy transfer.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Context: ${context}
        User Query: ${userQuery}
        
        Provide a concise, scientifically accurate, and engaging explanation suitable for a physics student. 
        Focus on the electromagnetic forces, bond dynamics, or quantum effects relevant to the current view.
        Do not use markdown formatting like bold or headers, just plain text or simple paragraphs.
      `,
    });
    
    return response.text || "No explanation generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to retrieve explanation from Gemini.";
  }
};
