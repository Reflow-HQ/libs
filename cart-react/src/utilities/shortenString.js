export default function shortenString(text, max = 100) {
  if (text.length > max) {
    return text.substring(0, max) + "...";
  }

  return text;
}
