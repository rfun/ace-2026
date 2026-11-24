import '../styles/tokens.css';
import '../styles/base.css';
import { useRoute } from './router';
import Browse from '../features/browse';
import Recipe from '../features/recipe';
import Compose from '../features/compose';
import Kitchen from '../features/kitchen';

export default function App(): JSX.Element {
  const route = useRoute();
  return (
    <div className="shell">
      <header className="shell-header">ACE Culture Cookbook</header>
      <main className="shell-main">
        {route.name === 'browse' && <Browse />}
        {route.name === 'recipe' && <Recipe />}
        {route.name === 'compose' && <Compose />}
        {route.name === 'kitchen' && <Kitchen />}
      </main>
    </div>
  );
}
