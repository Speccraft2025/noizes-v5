import { Composition, registerRoot } from 'remotion';
import { ExperienceDemo } from './compositions/ExperienceDemo';
import { HowToExplore } from './compositions/HowToExplore';
import { WhatsInside } from './compositions/WhatsInside';

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ExperienceDemo"
        component={ExperienceDemo}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="HowToExplore"
        component={HowToExplore}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="WhatsInside"
        component={WhatsInside}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};

registerRoot(RemotionRoot);
