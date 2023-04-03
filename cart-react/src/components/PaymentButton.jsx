export default function PaymentButton({ text, onClick }) {
  return (
    <div className="ref-button ref-payment-button" onClick={onClick}>
      {text}
    </div>
  );
}
