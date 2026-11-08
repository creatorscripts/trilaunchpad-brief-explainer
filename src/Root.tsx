import React from "react";
import { Composition } from "remotion";
import { BriefExplainer, timeline } from "./BriefExplainer";
import props from "../sample-props.json";

export const Root: React.FC = () => (
  <Composition
    id="BriefExplainer"
    component={BriefExplainer as any}
    durationInFrames={timeline(props as any).total}
    calculateMetadata={({ props: p }) => ({ durationInFrames: timeline(p as any).total })}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={props as any}
  />
);
