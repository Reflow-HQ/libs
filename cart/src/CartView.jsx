import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import IntlMessageFormat from "intl-messageformat";

const defaultLocalization = {
  locale: "en-US",
  "button.click": `You clicked {clickNum, plural, =0 {zero times.} =1 {one time.} other {# times.}}`,
};

global.R1 = React;

const CartView = ({ text, cartManager, localization = {} }) => {
  const [isLoading, setLoading] = useState(false);
  const [clickNum, setClicks] = useState(0);

  useEffect(() => {
    // Subscribing for events on the cart manager instance

    const subID = cartManager.subscribe((event, data) => {
      if (event == "loading") {
        setLoading(true);
      } else {
        setLoading(false);
      }
    });

    return () => {
      cartManager.unsubscribe(subID);
    };
  });

  const loc = {
    ...defaultLocalization,
    ...localization,
  };

  function t(key, data) {
    return new IntlMessageFormat(loc[key], loc.locale).format(data);
  }

  const onClick = () => {
    cartManager.addProduct({ productID: 12345 });
    setClicks(clickNum + 1);
  };

  /* Todo: write tests with jest. I need to have a variant that uses a static state as well. I also need
    to show different attributes for customizing panels, layout, injecting components, placing things in the URL(?)

   */

  return (
    <>
      <div className={"ref-loading-backdrop " + (isLoading ? "active" : "")}></div>
      <button className="test123" onClick={onClick}>
        {text} {t("button.click", { clickNum })}
      </button>
    </>
  );
};

CartView.propTypes = {
  text: PropTypes.string.isRequired,
};

export default CartView;
