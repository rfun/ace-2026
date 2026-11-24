import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import { formatHash, navigate, useRoute } from './router';
import logo from '../assets/ace-logo.png';
import Browse from '../features/browse';
import Recipe from '../features/recipe';
import Compose from '../features/compose';
import Kitchen from '../features/kitchen';

export default function App(): JSX.Element {
  const route = useRoute();
  return (
    <div className="shell">
      {route.name !== 'kitchen' && (
      <header className="shell-header">
        <a
          className="shell-home"
          href={formatHash({ name: 'browse' })}
          onClick={(e) => {
            e.preventDefault();
            navigate({ name: 'browse' });
          }}
        >
          <img className="shell-logo" src={logo} alt="ACE" width="32" height="32" />
          <span>ACE Culture Cookbook</span>
        </a>
      </header>
      )}
      <main className="shell-main">
        {route.name === 'browse' && <Browse />}
        {route.name === 'recipe' && <Recipe />}
        {route.name === 'compose' && <Compose />}
        {route.name === 'kitchen' && <Kitchen />}
      </main>
    </div>
  );
}
