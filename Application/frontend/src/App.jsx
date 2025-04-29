//App.jsx
import { Canvas } from "@react-three/fiber";

import Experience from "./Experience";
import Interface from "./Interface";
import { useState } from "react";

export default function App() {

  const [rotorRPM, setRotorRPM] = useState(""); 
  const [prediction, setPrediction] = useState(""); 

  const handleRotorRPMChange = (rpm) => {
    setRotorRPM(rpm);
  };
  const handlePredictionChange = (prediction) => {
    setPrediction(prediction);
  };


  return (

    <>
      <Canvas
        shadows
        camera={ {
            fov: 60,
            near: 0.1,
            far: 200,
            position: [ - 100, 50, 30 ]
        } }
    >
        <Experience rotorRPM={rotorRPM} prediction={prediction}/>
    </Canvas>
    <Interface onRotorRPMChange={handleRotorRPMChange} onPredictionChange={handlePredictionChange}/>
    </>
  );
}
