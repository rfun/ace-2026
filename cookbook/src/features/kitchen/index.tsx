import { useRoute } from '../../app/router';
import KitchenPage from './KitchenPage';

// The route passes no props, so fall back to the id in the current route.
export default function KitchenScreen(props: { id?: string }): JSX.Element {
  const route = useRoute();
  const id = props.id ?? (route.name === 'kitchen' ? route.id : '');
  return <KitchenPage id={id} />;
}
