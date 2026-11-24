import { useRoute } from '../../app/router';
import ComposePage from './ComposePage';

// App renders <Compose /> with no props, so fall back to the id in the current route.
export default function ComposeScreen(props: { id?: string }): JSX.Element {
  const route = useRoute();
  const id = props.id ?? (route.name === 'compose' ? route.id : undefined);
  return <ComposePage id={id} />;
}
