import React from "react";
import logo from "./assets/image1.png";
import "bootstrap/dist/css/bootstrap.min.css";
import { FiPlusCircle, FiUsers, FiDollarSign } from "react-icons/fi";
import "./App.css";

function Dashboard({ dark, setDark }) {
  return (
    <div className={dark ? "app dark" : "app light"}>
      {/* NAVBAR */}
      <nav className="navbar px-4 py-3">
        <div className="logo-container">
          <img src={logo} alt="IntelliDivide" className="logo" />
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-light"
            onClick={() => setDark(!dark)}
          >
            Toggle Theme
          </button>

          <button className="btn btn-primary d-flex align-items-center gap-2">
            <FiPlusCircle />
            Add Expense
          </button>
        </div>
      </nav>

      {/* DASHBOARD */}
      <div className="container mt-4">
        <div className="row g-4">
          <StatCard
            icon={<FiDollarSign />}
            title="Total Balance"
            amount="₹2,450"
            color="green"
          />
          <StatCard
            icon={<FiUsers />}
            title="You Owe"
            amount="₹1,200"
            color="red"
          />
          <StatCard
            icon={<FiUsers />}
            title="You Are Owed"
            amount="₹3,650"
            color="blue"
          />
        </div>

        {/* RECENT ACTIVITY */}
        <h5 className="mt-5 mb-3">Recent Activity</h5>
        <Activity text="Dinner with friends" amount="+ ₹350" />
        <Activity text="Cab split" amount="+ ₹350" />
        <Activity text="Movie night" amount="+ ₹350" />
      </div>
    </div>
  );
}

function StatCard({ icon, title, amount, color }) {
  return (
    <div className="col-md-4">
      <div className="stat-card">
        <div className={`icon ${color}`}>{icon}</div>
        <p className="title">{title}</p>
        <h2 className={color}>{amount}</h2>
      </div>
    </div>
  );
}

function Activity({ text, amount }) {
  return (
    <div className="activity">
      <span>{text}</span>
      <span className="green">{amount}</span>
    </div>
  );
}

export default Dashboard;
