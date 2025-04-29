import { OrbitControls, Sky } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Suspense } from 'react'
import Turbine from './Turbine.jsx'
import { useControls } from 'leva'

export default function Experience({rotorRPM,prediction})
{
    return <>

     
        <Sky sunPosition={[1,10,30]}/>
        <OrbitControls makeDefault maxPolarAngle={Math.PI/2.5} />
        

        <directionalLight castShadow position={ [ 1, 2, 3 ] }  />
        <ambientLight intensity={ 1} />

        <mesh receiveShadow position-y={ 1 } rotation-x={ - Math.PI * 0.5 } scale={ 1000 }>
            <planeGeometry />
            <meshStandardMaterial color="greenyellow" />
        </mesh>

      
        <Turbine rotorRPM={rotorRPM} predictionData={prediction}/>

    </>
}