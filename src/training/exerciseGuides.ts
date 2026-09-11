import type { Lift } from './engine';
import { liftNames } from './flows';

export type ExerciseGuide = {
  lift: Lift;
  name: string;
  description: string;
  cues: readonly string[];
  videoUrl: string;
  title: string;
  source: string;
  /** Reserved for bundled artwork, e.g. assets/exercise-images/squat.png. */
  image: `assets/exercise-images/${string}` | null;
};

// Local editorial content; media is optional and never part of persisted training.
export const EXERCISE_GUIDES: Readonly<Record<Lift, ExerciseGuide>> = {
  squat: {
    lift: 'squat', name: liftNames.squat,
    description: 'A barbell back squat trains the legs and hips while your braced torso supports the load.',
    cues: ['Set the bar securely on your upper back and grip it firmly.', 'Plant your whole foot, with toes turned slightly out.', 'Brace your torso before bending your hips and knees together.', 'Let your knees track with your toes and keep the bar over midfoot.', 'Stand back up with your hips and chest rising together.'],
    videoUrl: 'https://www.youtube.com/watch?v=UFs6E3Ti1jg', title: 'How To Squat - Any Style', source: 'Alan Thrall (Untamed Strength)', image: null,
  },
  bench_press: {
    lift: 'bench_press', name: liftNames.bench_press,
    description: 'A horizontal barbell press that trains the chest, shoulders and triceps from a stable bench setup.',
    cues: ['Use safeties or a spotter and keep your thumbs around the bar.', 'Plant your feet and set your shoulder blades against the bench.', 'Stack your wrists over your forearms as you lower the bar.', 'Touch your chest under control without bouncing.', 'Press up and slightly back while keeping your hips on the bench.'],
    videoUrl: 'https://www.youtube.com/watch?v=BYKScL2sgCs', title: 'How to Bench Press', source: 'Alan Thrall (Untamed Strength)', image: null,
  },
  overhead_press: {
    lift: 'overhead_press', name: liftNames.overhead_press,
    description: 'A standing strict barbell press trains the shoulders and triceps while your trunk keeps you steady.',
    cues: ['Start at your upper chest with forearms near vertical.', 'Brace your abdomen and squeeze your glutes to limit back arching.', 'Move your chin back just enough to let the bar pass.', 'Press close to your face without using leg drive.', 'Finish with the bar balanced overhead, then lower under control.'],
    videoUrl: 'https://www.youtube.com/watch?v=wol7Hko8RhY', title: '"How To" OVERHEAD PRESS', source: 'Alan Thrall (Untamed Strength)', image: null,
  },
  barbell_row: {
    lift: 'barbell_row', name: liftNames.barbell_row,
    description: 'A floor-start barbell row trains the upper back and arms while you hold a braced hip hinge.',
    cues: ['Hinge at your hips with soft knees and grip the bar outside your legs.', 'Brace and keep your back position steady with your torso near horizontal.', 'Pull the bar toward your lower chest by driving your elbows back.', 'Avoid turning the pull into a standing shrug.', 'Return the bar to the floor and reset before each rep.'],
    videoUrl: 'https://www.youtube.com/watch?v=RQU8wZPbioA', title: 'How To Barbell Row', source: 'Alan Thrall (Untamed Strength)', image: null,
  },
  deadlift: {
    lift: 'deadlift', name: liftNames.deadlift,
    description: 'A conventional deadlift trains the hips, legs and back by lifting a barbell from the floor to standing.',
    cues: ['Place the bar over midfoot with feet about hip-width apart.', 'Grip just outside your legs, then bring your shins to the bar.', 'Brace your torso and take tension out of the bar before lifting.', 'Push through the floor and keep the bar close to your legs.', 'Stand tall without leaning back; hinge to lower and reset each rep.'],
    videoUrl: 'https://www.youtube.com/watch?v=MBbyAqvTNkU', title: 'How To Deadlift: 5 Step Deadlift | 2022', source: 'Alan Thrall (Untamed Strength)', image: null,
  },
};

export function guideThumbnailUrl(guide: ExerciseGuide): string {
  const videoId = guide.videoUrl.split('v=')[1];
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
