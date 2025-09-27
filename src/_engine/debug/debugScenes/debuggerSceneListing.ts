import { BATTLE_SCENE_ID, battleScene } from '../../../app/battleScene';

export type DebugScene = { id: string; fn: () => Promise<string>; text: string };

export const debuggerSceneListing: DebugScene[] = [
  {
    id: BATTLE_SCENE_ID,
    fn: battleScene,
    text: 'Battle scene',
  },
];
