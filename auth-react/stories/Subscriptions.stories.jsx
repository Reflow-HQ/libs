import "./styles.css";

import useAuth from "@reflowhq/auth-react";
import React, { useState, useEffect } from "react";

const config = {
  storeID: "199976733",
  apiBase: "http://test-api.reflow.local/v2",
  testMode: true,
};

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Example/Subscriptions",
  component: App,
};

export const App = ({}) => {
  const auth = useAuth(config);

  const [paymentProvider, setPaymentProvider] = useState("stripe");
  const [plans, setPlans] = useState([]);
  const [activeTab, setActiveTab] = useState("month");

  useEffect(() => {
    fetch(`${config.apiBase}/stores/${config.storeID}/plans/`)
      .then((response) => response.json())
      .then((r) => setPlans(r.data))
      .catch((error) => console.error(error));
  }, []);

  return (
    <>
      {auth.isSignedIn() ? (
        <button className="danger" onClick={() => auth.signOut()}>
          Sign Out
        </button>
      ) : (
        ""
      )}
      {auth.isSubscribed() ? (
        <div>
          <h1>Thank you for subscribing!</h1>
          <button onClick={() => auth.modifySubscription()}>Modify Subscription</button>
          <p>
            Plan Name: <b>{auth.subscription.plan.name}</b>
            <br />
            Price:{" "}
            <b>
              {auth.subscription.price.price_formatted} /{auth.subscription.price.billing_period}
            </b>
          </p>
          <h4>RAW Subscription info:</h4>
          <pre>{JSON.stringify(auth.subscription, null, "  ")}</pre>
        </div>
      ) : (
        <div style={{ maxWidth: 800 + "px" }}>
          <div className="tabs">
            <span
              className={paymentProvider === "stripe" ? "active" : ""}
              onClick={() => setPaymentProvider("stripe")}
            >
              Stripe
            </span>
            <span
              className={paymentProvider === "paddle" ? "active" : ""}
              onClick={() => setPaymentProvider("paddle")}
            >
              Paddle
            </span>
          </div>
          <div className="tabs">
            <span
              className={activeTab === "month" ? "active" : ""}
              onClick={() => setActiveTab("month")}
            >
              Monthly
            </span>
            <span
              className={activeTab === "year" ? "active" : ""}
              onClick={() => setActiveTab("year")}
            >
              Yearly
            </span>
          </div>
          <div className="card-container">
            {plans.map((p) => (
              <Plan
                key={p.id}
                plan={p}
                activeTab={activeTab}
                auth={auth}
                paymentProvider={paymentProvider}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export const Plan = ({ plan, activeTab, auth, paymentProvider }) => {
  let chosenPrice = plan.prices[0];

  for (let p of plan.prices) {
    if (p.billing_period === activeTab) {
      chosenPrice = p;
    }
  }

  function subscribeToPlan() {
    auth.createSubscription({ priceID: chosenPrice.id, paymentProvider: paymentProvider });
  }

  return (
    <div className="card">
      <h1>{plan.name}</h1>
      <p>{plan.description}</p>
      <ul>
        {plan.features.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
      <h2>
        {chosenPrice.price === 0
          ? "Free"
          : chosenPrice.price_formatted + " / " + chosenPrice.billing_period}
      </h2>
      <button onClick={subscribeToPlan}>Subscribe</button>
    </div>
  );
};
