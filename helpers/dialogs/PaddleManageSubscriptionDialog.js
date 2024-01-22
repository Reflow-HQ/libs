import {
  initializePaddle
} from '@paddle/paddle-js';
import Dialog from './Dialog';

class PaddleManageSubscriptionDialog extends Dialog {
  constructor({
    container,
    updatePlan,
    cancelSubscription,
  }) {

    super({
      id: 'paddle-manage-subscription-dialog',
      container,
      width: 740,
      showHeader: true,
      showClose: true,
      title: 'Manage Subscription'
    })

    this._updatePlan = updatePlan
    this._cancelSubscription = cancelSubscription

    this._paddleUpdatePaymentCheckout = null;
  }

  addEventListeners() {

    super.addEventListeners();

    this._dialog.addEventListener('click', async (e) => {

      if (e.target.closest('.hyperlink')) {
        // Don't prevent default normal links
        return;
      }

      e.preventDefault();

      if (this._isLoading) {
        return;
      }

      if (e.target.closest('.ref-change-plan')) {
        this.state.selectPlan = true;
        this.render();
      }

      if (e.target.closest('.ref-change-plan-cancel')) {
        this.state.selectPlan = false;
        this.render();
      }

      // Update plan/price

      let updatePlanButton = e.target.closest('.ref-change-plan-update');
      if (updatePlanButton) {

        let selected = this.state.price_selected;
        let current = this.state.subscription.price;

        if (selected.id != current.id) {

          let loadingIndicator = document.createElement("span");
          loadingIndicator.textContent = " Loading...";
          updatePlanButton.append(loadingIndicator);

          this._isLoading = true;

          try {

            let response = await this._updatePlan(selected.id)

            if (!response.status || response.status != 'success') {
              throw new Error("Unable to update subscription plan");
            }

            // Update the state of the dialog, without fetching the updated sub from the server.

            this.state.subscription.plan = response.plan;
            this.state.subscription.price = response.price;
            if (response.paddle_subscription) {
              this.state.subscription.next_billing = Date.parse(response.paddle_subscription.next_billed_at) / 1000;
            }
            this.state.updatePlanOptions = null;

            this._isLoading = false;
            loadingIndicator && loadingIndicator.remove();

            this.showToast({
              type: 'success',
              title: 'Your subscription plan was updated',
            });

            this.state.selectPlan = false;
            this.render();

          } catch (e) {

            this._isLoading = false;
            loadingIndicator && loadingIndicator.remove();

            // Show error toast. Do no rerender.

            this.showToast({
              type: 'error',
              title: 'An error occurred while saving your changes',
              description: 'Please try again'
            })

            throw e;
          }
        }

        this.state.selectPlan = false;
        this.render();
      }

      // Switch between monthly/yearly groups

      let priceGroupButton = e.target.closest('.ref-price-group-button');
      if (priceGroupButton) {

        if (this.state.subscription.price.billing_period == priceGroupButton.dataset.billing_period) {
          this.state.price_selected = this.state.subscription.price;
        } else {
          this.state.price_selected = this.state.updatePlanOptions[priceGroupButton.dataset.billing_period][0].price;
        }

        this.render();
      }

      // Select new price card

      let priceOption = e.target.closest('.ref-price-update-option');
      if (priceOption) {

        let clicked = this.state.updatePlanOptions[priceOption.dataset.billing_period].find(o => o.price.id == priceOption.dataset.price_id);
        this.state.price_selected = clicked.price;

        this.render();
      }

      // Cancel subscription

      let cancelButton = e.target.closest('.ref-cancel-plan');
      if (cancelButton && !this.state.subscription.cancel_at) {

        if (!window.confirm('Are you sure you want to cancel your subscription?')) {
          return;
        }

        let loadingIndicator = document.createElement("span");
        loadingIndicator.textContent = " Loading...";
        cancelButton.append(loadingIndicator);

        this._isLoading = true;

        try {

          let response = await this._cancelSubscription();

          if (!response.status || response.status != 'success') {
            throw new Error("Unable to update subscription");
          }

          if (response.cancel_at) {
            this.state.subscription.cancel_at = response.cancel_at;

            // This disables other action in the dialog, that should not be accessible to canceled subs.
            this.state.update_payment_transaction_id = null;
            this.state.available_plans = [];
          }

          this._isLoading = false;
          loadingIndicator && loadingIndicator.remove();

          this.showToast({
            type: 'success',
            title: 'Your subscription has been cancelled.',
          });

          this.render();

        } catch (e) {

          this._isLoading = false;
          loadingIndicator && loadingIndicator.remove();

          // Show error toast. Do no rerender.

          this.showToast({
            type: 'error',
            title: 'An error occurred while saving your changes',
            description: 'Please try again'
          })

          throw e;
        }
      }

      // Update payment details

      let updatePayment = e.target.closest('.ref-edit-payment');
      if (updatePayment) {

        if (!this._paddleUpdatePaymentCheckout) {

          this._paddleUpdatePaymentCheckout = await initializePaddle({
            environment: this.state.subscription.livemode ? 'production' : 'sandbox',
            seller: this.state.paddle_seller_id,
            eventCallback: function (ev) {

              if (ev.name == "checkout.completed") {

                // Paddle returns this data in a very inconsistent manner. 
                // Try fixing it as much as possible. 
                if (ev.data.payment.method_details.card) {
                  this.state.billing.payment_method = {
                    card: ev.data.payment.method_details.card,
                    type: 'card'
                  }
                } else {
                  this.state.billing.payment_method = {
                    card: null,
                    type: "paypal"
                  }
                }
              }

              if (ev.name == "checkout.closed") {

                if (ev.checkout.completed) {
                  this.showToast({
                    type: 'success',
                    title: 'Your payment information was updated',
                  });
                }

                this.open();
              }

            }.bind(this)
          });
        }

        this.close();

        this._paddleUpdatePaymentCheckout.Checkout.open({
          transactionId: this.state.update_payment_transaction_id
        });
      }

    });
  }

  render(data) {

    super.render(data);

    let css = `
    dialog {
      padding: 1em 1.2em;
    }

    .ref-show-md {
      display:none;
    }

    .ref-section {
      display: flex;
      flex-direction: column;
    }

    .ref-section > div:first-of-type {
      margin-bottom: 1rem;
    }

    @media (min-width: 650px) {
      dialog {
        padding: 2.8em 3em;
      }

      .ref-show-md {
        display: unset;
      }

      .ref-section {
        flex-direction: row;
        justify-content: space-between;
      }
    }

    @media (max-width: 1000px) {
      dialog {
        width: calc(100% - 200px) !important;
      }
    }

    @media (max-width: 650px) {
      dialog {
        width: calc(100% - 60px) !important;
      }
      td.ref-payments-td {
        padding: 0 .8em 0 0 !important;
      }
      td.ref-payments-td:last-of-type {
        max-width: 100px;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
    }
    `

    let style = document.createElement('style');
    style.textContent = css;
    this._shadowDOM.prepend(style);

    let button = document.createElement('button')
    button.style.display = 'block';
    button.style.background = '#383d40';
    button.style.appearance = 'none';
    button.style.padding = '8px';
    button.style.color = '#fff';
    button.style.fontSize = '.8em';
    button.style.fontWeight = 'bold';
    button.style.borderRadius = '6px';
    button.style.boxShadow = '1px 1px 4px 0 rgba(0,0,0,0.1)';
    button.style.width = '125px';
    button.style.cursor = 'pointer';
    button.style.margin = '4px 0 12px';

    let section = document.createElement('div');
    section.style.marginBottom = '2.75em';

    let planSection = section.cloneNode();
    this._container.append(planSection);

    let sectionTitle = document.createElement('h4');
    sectionTitle.style.textTransform = 'uppercase';
    sectionTitle.style.color = '#848e97';
    sectionTitle.style.fontSize = '.7em';
    sectionTitle.style.borderBottom = '1px solid #dee2e6';
    sectionTitle.style.paddingBottom = '8px';
    sectionTitle.style.marginBottom = '12px';
    planSection.append(sectionTitle);

    if (this.state.selectPlan && this.state.available_plans.length) {

      // Plan update interface

      sectionTitle.textContent = 'Update Plan';

      if (!this.state.updatePlanOptions) {

        let currentPrice = this.state.subscription.price;
        let isCurrentAvailable = false;
        let options = {
          'month': [],
          'year': [],
        }
        this.state.price_selected = currentPrice;

        for (const updateOption of this.state.available_plans) {

          for (const price of updateOption.prices) {

            if (price.id === currentPrice.id) {
              isCurrentAvailable = true;
            }

            options[price.billing_period].push({
              plan: updateOption.plan,
              price
            });
          }
        }

        if (!isCurrentAvailable) {

          // The current plan is no longer available.
          // Add the current plan as the first "available" plan. 
          // It will be selectable but not usable for updates.

          currentPrice.is_disabled = true;
          options[currentPrice.billing_period].unshift({
            plan: this.state.subscription.plan,
            price: currentPrice
          });
        }

        this.state.updatePlanOptions = options;
      }

      let mButton, yButton, mContainer, yContainer;

      if (this.state.updatePlanOptions.month.length && this.state.updatePlanOptions.year.length) {

        mButton = button.cloneNode();
        mButton.textContent = 'Monthly';
        mButton.classList.add('ref-price-group-button');
        mButton.dataset.billing_period = 'month';
        mButton.style.display = 'inline-block';
        mButton.style.width = 'auto';
        mButton.style.padding = '6px 10px';
        mButton.style.background = '#fff';
        mButton.style.border = '1px solid #aaafb4';
        mButton.style.color = '#aaafb4';
        mButton.style.marginRight = '5px';
        planSection.append(mButton);

        yButton = mButton.cloneNode();
        yButton.textContent = 'Yearly';
        yButton.dataset.billing_period = 'year';
        planSection.append(yButton);
      }

      if (this.state.updatePlanOptions.month.length) {
        mContainer = document.createElement('div');
        mContainer.style.display = 'none';
        planSection.append(mContainer);

        for (const mp of this.state.updatePlanOptions.month) {
          mContainer.append(this.renderPriceOption(mp));
        }
      }

      if (this.state.updatePlanOptions.year.length) {
        yContainer = document.createElement('div');
        yContainer.style.display = 'none';
        planSection.append(yContainer);

        for (const yp of this.state.updatePlanOptions.year) {
          yContainer.append(this.renderPriceOption(yp));
        }
      }

      if (this.state.price_selected.billing_period == 'month') {
        if (mButton) {
          mButton.style.borderColor = '2px solid #212529';
          mButton.style.color = '#212529';
        }
        mContainer.style.display = 'block';
      } else {
        if (yButton) {
          yButton.style.borderColor = '2px solid #212529';
          yButton.style.color = '#212529';
        }
        yContainer.style.display = 'block';
      }

      let prorationDate, prorationText;

      if (this.state.subscription.price.id == this.state.price_selected.id) {

        // Don't show proration info

      } else if (this.state.subscription.status == 'trialing') {

        // Trial will stop. Billing date will be now.
        prorationDate = 'now';
        prorationText = 'Changing your subscription plan will stop your free trial. You will be billed immediately to reflect the new pricing.';

      } else if (this.state.subscription.price.billing_period != this.state.price_selected.billing_period) {

        // Changes billing date.
        prorationDate = 'now';
        prorationText = 'You will be billed immediately to reflect the new billing period.';

      } else if (!this.state.subscription.price.price && this.state.price_selected.price) {

        // Changes from free to paid plan.
        prorationDate = 'now';
        prorationText = 'You will be billed immediately to reflect the new pricing.';

      } else {

        // Keeps billing date.
        prorationDate = this.state.subscription.next_billing;
        prorationText = 'Your next payment will be prorated to account for the updated pricing. The billing schedule will remain the same.';
      }

      if (prorationDate && prorationText) {
        let prorationInfo = document.createElement('div');
        prorationInfo.innerHTML = `<b style="margin-bottom: ;">Next payment on: ${this.formatDate(prorationDate)}.</b><p style="margin: .2em 0 0 0;">${prorationText}</p>`;
        prorationInfo.style.marginTop = '2em';
        prorationInfo.style.fontSize = '0.9em';
        planSection.append(prorationInfo);
      }

      let changePlanConfirm = button.cloneNode();
      changePlanConfirm.textContent = 'Update';
      changePlanConfirm.classList.add('ref-change-plan-update');
      changePlanConfirm.style.display = 'inline-block';
      changePlanConfirm.style.marginRight = '12px';
      changePlanConfirm.style.marginTop = '3em';
      if (this.state.price_selected.id == this.state.subscription.price.id) {
        changePlanConfirm.disabled = true;
        changePlanConfirm.style.opacity = .7;
        changePlanConfirm.style.background = 'rgb(108 115 119)';
        changePlanConfirm.style.pointerEvents = 'none';
      }
      planSection.append(changePlanConfirm);

      let changePlanCancel = button.cloneNode();
      changePlanCancel.textContent = 'Cancel';
      changePlanCancel.classList.add('ref-change-plan-cancel');
      changePlanCancel.style.display = 'inline-block';
      changePlanCancel.style.color = '#383d40';
      changePlanCancel.style.border = '1px solid rgba(0,0,0,0.2)';
      changePlanCancel.style.background = '#fff';
      planSection.append(changePlanCancel);

    } else {

      // Show current plan

      sectionTitle.textContent = 'Current Plan';

      let current = document.createElement('div');
      current.classList.add('ref-section');
      planSection.append(current);

      let left = document.createElement('div');
      current.append(left);

      let planName = document.createElement('p');
      planName.textContent = this.state.subscription.plan.name;
      planName.style.margin = '0';
      left.append(planName);

      let planPrice = document.createElement('p');
      planPrice.textContent = this.formatAmount(this.state.subscription.price.price, this.state.subscription.price.currency) + '/' + this.state.subscription.price.billing_period;
      planPrice.style.fontSize = '1.2em';
      planPrice.style.fontWeight = 'bold';
      planPrice.style.margin = '.2em 0';
      left.append(planPrice);

      let nextPlanAction = document.createElement('p');
      nextPlanAction.style.margin = '0';
      nextPlanAction.style.fontSize = '.9em';
      nextPlanAction.style.color = '#495057';

      if (this.state.subscription.cancel_at) {
        nextPlanAction.textContent = 'Your subscription will be canceled on ' + this.formatDate(this.state.subscription.cancel_at);
        nextPlanAction.style.color = '#ff0051';
      } else if (this.state.subscription.status == 'trialing') {
        nextPlanAction.textContent = 'Free trial is active, first billing will be on ' + this.formatDate(this.state.subscription.next_billing);
      } else {
        nextPlanAction.textContent = 'Your plan renews on ' + this.formatDate(this.state.subscription.next_billing);
      }

      left.append(nextPlanAction);

      if (!this.state.subscription.cancel_at) {

        let right = document.createElement('div');
        current.append(right);

        if (this.state.available_plans.length) {
          let changePlan = button.cloneNode();
          changePlan.textContent = 'Change plan';
          changePlan.classList.add('ref-change-plan');
          right.append(changePlan);
        }

        let cancelPlan = button.cloneNode();
        cancelPlan.classList.add('ref-cancel-plan');
        cancelPlan.textContent = 'Cancel plan';
        cancelPlan.style.color = '#383d40';
        cancelPlan.style.border = '1px solid rgba(0,0,0,0.2)';
        cancelPlan.style.background = '#fff';
        right.append(cancelPlan);
      }
    }

    // Billing info

    let paymentSection = section.cloneNode(false);
    this._container.append(paymentSection);

    sectionTitle = sectionTitle.cloneNode(false);
    sectionTitle.textContent = 'Payment and billing info';
    paymentSection.append(sectionTitle);

    let flex = document.createElement('div');
    flex.classList.add('ref-section');
    paymentSection.append(flex);

    let left = document.createElement('div');
    flex.append(left);

    let paymentLine = document.createElement('p');
    paymentLine.style.margin = '0 0 .3em 0';

    let paymentMethod = paymentLine.cloneNode();
    paymentMethod.innerHTML = '<b></b><span></span>';

    if (this.state.billing.payment_method) {

      if (this.state.billing.payment_method.type == 'card') {

        paymentMethod.firstElementChild.textContent = 'Card ';

        let card = this.state.billing.payment_method.card;
        paymentMethod.lastElementChild.textContent = `${card.type[0].toUpperCase()}${card.type.substring(1)} ****${card.last4}`;

        let expirationDate = new Date(card.expiry_year, card.expiry_month);
        let today = new Date();
        let monthDiff = expirationDate.getMonth() - today.getMonth() + 12 * (expirationDate.getFullYear() - today.getFullYear());

        let expires = document.createElement('span');
        let dateString = this.formatDate(expirationDate, {
          month: 'short'
        }) + ' ' + expirationDate.getFullYear().toString().slice(-2);
        if (monthDiff < 0) {
          expires.textContent = ` (expired on ${dateString})`;
          expires.style.color = '#ff0051';
        } else if (monthDiff < 6) {
          expires.textContent = ` (expires on ${dateString})`;
          expires.style.color = '#c3c31b';
        }
        paymentMethod.append(expires);
        left.append(paymentMethod);

      } else if (this.state.billing.payment_method.type == 'paypal') {

        paymentMethod.firstElementChild.textContent = 'Payment Method ';
        paymentMethod.lastElementChild.textContent = 'PayPal';
        left.append(paymentMethod);
      }
    }

    if (this.state.billing.name) {
      let name = paymentLine.cloneNode();
      name.innerHTML = '<b>Name </b><span></span>';
      name.lastElementChild.textContent = this.state.billing.name;
      left.append(name);
    }

    if (this.state.billing.email) {
      let email = paymentLine.cloneNode();
      email.innerHTML = '<b>Email </b><span></span>';
      email.lastElementChild.textContent = this.state.billing.email;
      left.append(email);
    }

    if (this.state.billing.address) {
      let address = paymentLine.cloneNode();
      address.innerHTML = '<b>Address </b><span></span>';
      address.lastElementChild.textContent = `${this.state.billing.address.line1 || ''} ${this.state.billing.address.city || ''} ${this.state.billing.address.country}`;
      left.append(address);
    }

    if (this.state.billing.taxes && this.state.billing.taxes.tax_ids && this.state.billing.taxes.tax_ids.length) {
      let taxID = paymentLine.cloneNode();
      taxID.innerHTML = '<b>Tax ID </b><span></span>';
      taxID.lastElementChild.textContent = this.state.billing.taxes.tax_ids[0].value;
      left.append(taxID);
    }

    if (this.state.update_payment_transaction_id && this.state.paddle_seller_id) {
      let right = document.createElement('div');
      flex.append(right);

      let editPayment = button.cloneNode();
      editPayment.textContent = 'Edit';
      editPayment.classList.add('ref-edit-payment');
      editPayment.style.width = '90px';
      right.append(editPayment);
    }

    // Payments

    let invoicesSection = section.cloneNode(false);
    invoicesSection.style.marginBottom = 0;
    this._container.append(invoicesSection);

    sectionTitle = sectionTitle.cloneNode(false);
    sectionTitle.textContent = 'Recent Payments';
    invoicesSection.append(sectionTitle);

    let paymentsTable = document.createElement("table");

    for (const payment of this.state.recent_payments) {
      let row = paymentsTable.insertRow();

      let cell = row.insertCell();
      cell.classList.add('ref-payments-td');
      cell.style.padding = '0 1.5em .8em 0';

      if (payment.invoice_number && payment.total > 0) {
        let a = document.createElement('a');
        a.classList.add('hyperlink');
        a.href = payment.download_url;
        a.download = 'invoice-' + payment.id;
        a.target = '_blank';
        a.style.textDecoration = 'none';
        a.style.color = '#383d40';
        a.innerHTML = `
          ${this.formatDate(payment.created, {
            month: 'short',
            day: 'numeric'
          })}<span class="ref-show-md">, ${this.formatDate(payment.created, {
            year: 'numeric',
          })}</span>
          <span style="position: relative; top: 1px;">
            <svg viewBox="0 0 16 16" width=".8em" height=".8em" fill="currentColor" xmlns="http://www.w3.org/2000/svg">  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg>
          </span>`;
        cell.append(a);
      } else {
        let span = document.createElement('span');
        span.style.color = '#383d40';
        span.textContent = this.formatDate(payment.created)
        cell.append(span);
      }

      cell = row.insertCell();
      cell.classList.add('ref-payments-td');
      cell.style.padding = '0 1.5em .8em 1.5em';
      cell.style.textAlign = 'center';
      cell.textContent = this.formatAmount(payment.grand_total, payment.currency);

      cell = row.insertCell();
      cell.classList.add('ref-payments-td');
      cell.style.padding = '0 1.5em .8em 1.5em';
      let badge = document.createElement('span');
      badge.style.padding = '5px 10px';
      badge.style.background = '#feefcc';
      badge.style.color = '#644600';
      badge.style.textTransform = 'uppercase';
      badge.style.fontSize = '.6em';
      badge.style.fontWeight = 'bolder';
      badge.style.lineHeight = '1';
      badge.style.borderRadius = '4px';
      badge.style.position = 'relative';
      badge.style.top = '-2px';
      badge.textContent = payment.status;
      cell.append(badge);

      cell = row.insertCell();
      cell.classList.add('ref-payments-td');
      cell.style.padding = '0 0 .8em 1.5em';
      cell.textContent = payment.purchased_item;
    }

    invoicesSection.append(paymentsTable);
  }

  renderPriceOption(updateOption) {

    let plan = updateOption.plan;
    let price = updateOption.price;

    let card = document.createElement('div');
    card.classList.add('ref-price-update-option');
    card.dataset.price_id = price.id;
    card.dataset.billing_period = price.billing_period;
    card.style.display = 'inline-block';
    card.style.width = '200px';
    card.style.padding = '20px';
    card.style.border = '2px solid transparent';
    card.style.borderRadius = '8px';
    card.style.marginRight = '5px';

    if (price.id == this.state.subscription.price.id) {

      let currentBadge = document.createElement('span')
      currentBadge.textContent = 'Current Plan';
      currentBadge.style.display = 'inline-block'
      currentBadge.style.color = '#fff';
      currentBadge.style.fontWeight = 'bold';
      currentBadge.style.fontSize = '.8em';
      currentBadge.style.padding = '3px 10px';
      currentBadge.style.borderRadius = '20px';
      currentBadge.style.marginBottom = '1em';
      card.append(currentBadge);

      if (price.is_disabled) {
        card.title = 'This plan is no longer available';
        currentBadge.style.background = "#848e97";
      } else {
        currentBadge.style.background = "#0d6efd";
      }
    }

    let name = document.createElement('p');
    name.textContent = plan.name;
    name.style.margin = '0 0 2em 0';
    card.append(name);

    let priceAmount = document.createElement('b')
    priceAmount.textContent = this.formatAmount(price.price, price.currency);
    priceAmount.style.display = 'block';
    priceAmount.style.lineHeight = '.5';
    card.append(priceAmount);

    let pricePeriod = document.createElement('span')
    pricePeriod.textContent = 'per ' + price.billing_period;
    pricePeriod.style.fontSize = '.8em';
    card.append(pricePeriod);

    let button = document.createElement('button')
    button.textContent = 'Select';
    button.style.display = 'block';
    button.style.width = '100%';
    button.style.appearance = 'none';
    button.style.background = '#fff';
    button.style.color = '#212529';
    button.style.border = '1px solid #dedfe1';
    button.style.padding = '8px';
    button.style.fontSize = '.9em';
    button.style.fontWeight = 'bold';
    button.style.borderRadius = '6px';
    button.style.marginTop = '2em';
    card.append(button);

    if (price.id == this.state.price_selected.id) {

      card.style.borderColor = price.is_disabled ? "#dee2e6" : "#0d6efd";

      button.textContent = 'Selected';
      button.style.color = price.is_disabled ? "#848e97" : "#0d6efd";
      button.style.boxShadow = '1px 1px 4px 0 rgba(0,0,0,0.1)';
      button.style.border = '1px solid #dee2e6';

      let svg = document.createElement('span');
      svg.style.position = 'relative';
      svg.style.top = '1px';
      svg.style.marginRight = '5px';
      svg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height=".8em" viewBox="0 -960 960 960" width=".8em" fill="currentColor"><path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>`;
      button.prepend(svg);
    }

    return card;
  }

  formatAmount(amount, currency) {
    let fractionDigits = 0;

    if (isNaN(amount)) {
      amount = 0;
    }

    if (!currency.zero_decimal) {
      // Currencies with cents are kept in the smallest unit ($12.34 is 1234 in the DB)
      // Divide by 100 to get the proper float value.
      // For currencies without decimals, the amount is already the correct int value.
      amount = amount / 100;
      fractionDigits = 2;
    }

    return new Intl.NumberFormat(this.localization ? this.localization.locale : "en-US", {
      style: "currency",
      currency: currency.code,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  }

  formatDate(date, format) {

    if (date == 'now') {
      date = new Date();
    } else {
      date = new Date(date * 1000);
    }

    format = format || {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }

    return date.toLocaleDateString(this.localization ? this.localization.locale : "en-US", format);
  }
}

export default PaddleManageSubscriptionDialog;
