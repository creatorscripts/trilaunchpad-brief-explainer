import React from "react";
import { Composition } from "remotion";
import { BriefExplainer, timeline } from "./BriefExplainer";
import { CastList, castTimeline } from "./CastList";
import props from "../sample-props.json";
import castProps from "../sample-castlist.json";

export const Root: React.FC = () => (
  <>
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
    <Composition
      id="CastList"
      component={CastList as any}
      durationInFrames={castTimeline(castProps as any).total}
      calculateMetadata={({ props: p }) => ({ durationInFrames: castTimeline(p as any).total })}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={castProps as any}
    />
  </>
);
