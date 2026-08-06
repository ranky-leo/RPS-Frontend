"use client";

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Scene from "./Scene";

type MatchIntroCutsceneProps = {
  trigger: number;
};

export default function MatchIntroCutscene({
  trigger,
}: MatchIntroCutsceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 0.2, 6], fov: 48, near: 0.1, far: 40 }}
    >
      <Scene trigger={trigger} />
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={0.95}
          luminanceThreshold={0.22}
          radius={0.58}
        />
      </EffectComposer>
    </Canvas>
  );
}
