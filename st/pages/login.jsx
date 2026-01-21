import { useState } from "react";
import { FiMail, FiLock } from "react-icons/fi";
import "./login.css";
import logo from "../assets/image1.png";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    // later you can validate from backend
    console.log(email, password);

    onLogin(); // 👈 switch to dashboard
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="IntelliDivide" className="login-logo" />

        <h3>Welcome back</h3>
        <p className="subtitle">Login to manage your expenses</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <FiMail />
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <FiLock />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="login-btn">Login</button>
        </form>

        <p className="footer-text">
          Don’t have an account? <span>Sign up</span>
        </p>
      </div>
    </div>
  );
}

export default Login;
