import { useRoute } from '../../app/router';
import RecipePage from './RecipePage';

// The T0 route passes no props, so fall back to the id in the current route.
export default function RecipeScreen(props: { id?: string; onAddTip?: () => void }): JSX.Element {
  const route = useRoute();
  const id = props.id ?? (route.name === 'recipe' ? route.id : '');
  return <RecipePage id={id} onAddTip={props.onAddTip} />;
}
