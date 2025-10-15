import { useState } from "react";
import { Link } from "react-router-dom";
import reactLogo from "~/assets/react.svg";

const handleButtonClick = () => {
  return fetch("/api/example", {
    method: "POST",
    body: JSON.stringify({ time: Date.now() }),
  });
};

const Home: React.FC = () => {
  const [payload, setPayload] = useState();

  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="/logo.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="list">
        <p>
          Visit <Link to="/ssr">/my-dynamic-url</Link> to see the
          server-side-rendered content.
        </p>
        <p>
          <button
            onClick={() =>
              handleButtonClick().then(async (res) => {
                const data = await res.json();
                setPayload(data);
              })
            }
          >
            Click here
          </button>{" "}
          to make a request to the API.
        </p>
        {payload && (
          <p>
            Received payload:<code>{JSON.stringify(payload)}</code>
          </p>
        )}
        <p>
          Checkout template from{" "}
          <a href="https://github.com/stormkit-io/react-starter">GitHub</a>
        </p>
      </div>
      <p className="powered-by">
        Template by{" "}
        <a
          href="https://www.stormkit.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/stormkit-logo.svg" />
        </a>
      </p>
    </div>
  );
};

export default Home;
