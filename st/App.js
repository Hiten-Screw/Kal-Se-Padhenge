import { useState } from "react";
import Login from "./pages/login";
import Dashboard from "./Dashboard";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dark, setDark] = useState(true);

  return (
    <>
      {isLoggedIn ? (
        <Dashboard dark={dark} setDark={setDark} />
      ) : (
        <Login onLogin={() => setIsLoggedIn(true)} />
      )}
    </>
  );
}

export default App;
