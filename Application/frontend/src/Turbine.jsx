import { useEffect, useRef, useState } from "react";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";

export default function Turbine({ rotorRPM,predictionData }) {
    const turbine = useGLTF("./Turbine/turbine2.glb");
    const animations = useAnimations(turbine.animations, turbine.scene);
    const animationName = "BladeRotation";
    const sockRef = useRef();
    const [linearKendallFlag, setLinearKendallTauNorm] = useState(false); 

    useEffect(() => {
        const action = animations.actions[animationName];
        if (action) {
            action.reset().fadeIn(0.5).play();
            return () => action.fadeOut(0.5);
        }
    }, [animationName, animations]);

    useEffect(() => {

        
        if (!rotorRPM || rotorRPM.RotorRPM == null) return;
        const speed = rotorRPM.RotorRPM * (2 * Math.PI / 60); // Convert RPM to radians/sec
        if (animations.actions[animationName]) {
            animations.actions[animationName].timeScale = speed; // Adjust animation speed
        }
    }, [rotorRPM?.RotorRPM, animations, animationName]);

    useEffect(()=>{
    if((predictionData.normalised_kendall_tau_linear ) < 0.55
    ){
        setLinearKendallTauNorm(true);
    }
    if((predictionData.normalised_kendall_tau_linear ) > 0.55
    ){
        setLinearKendallTauNorm(false);
    }
    }, [predictionData])

    useFrame(({ clock }) => {
        
        if (!sockRef.current || !rotorRPM) return;

        // Get current wind values (fallbacks if missing)
        const windDir = rotorRPM.WindDirAbs ?? 100;
        const windGust = rotorRPM.WindDirRel ?? 2;

        // Smooth rotation towards the new wind direction
        sockRef.current.rotation.y += (windDir * (Math.PI / 180) - sockRef.current.rotation.y) * 0.1;

        // Add natural swaying effect
        sockRef.current.rotation.z = Math.sin(clock.elapsedTime * 2) * (windGust * 0.02);
    });

    return (
        <>
            {/* Turbine Model */}
            <primitive  object={turbine.scene} scale={2} rotation-y={ - Math.PI * 0.25 } />
            
            {linearKendallFlag === true &&
            <Html position={[25, 30, 20]} zIndexRange={99}>
                
                <h3 className="warningAnnotation"><b>Warning!</b></h3>
                <div className="warningAnnotation"><b>Fault Detected,
                    Please check turbine. <br></br>Suspected Issue:{predictionData.leadLocal_Variable_Linear}(Linear Regression) / {predictionData.leadLocal_Variable_MLP}(MLP Regrssion)</b>
             
                </div>
            </Html>}
            

            {/* Windsock
            <group ref={sockRef}>
                <mesh position={[0, 0, 5]}>
                    <cylinderGeometry args={[0.8, 0.8, 15, 32]} />
                    <meshStandardMaterial color="lightblue" />
                </mesh>
                <mesh position={[0, 15, 5]}>
                    <coneGeometry args={[0.8, 3, 32]} />
                    <meshStandardMaterial color="red" />
                </mesh>
            </group> */}
        </>
    );
}
