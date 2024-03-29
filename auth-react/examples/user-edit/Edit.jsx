import React, { useState, useRef } from "react";

import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

export default function Edit({ user, onChange, resetPassword }) {
  const [newData, setData] = useState({ ...user });
  const [isModalVisible, setVisible] = useState(false);

  const [enteredEmail, setEnteredEmail] = useState(user.email || "");
  const [emailError, setEmailError] = useState(false);

  const emailRef = useRef(null);

  function changeName(newName) {
    setData({
      ...newData,
      name: newName,
    });
  }

  function changeEmail(newEmail) {
    setEnteredEmail(newEmail);

    if (emailRef.current.validity.valid) {
      setData({
        ...newData,
        email: newEmail,
      });

      setEmailError(false);
    } else {
      setEmailError(true);
    }
  }

  function changeSetting(newSetting) {
    let copy = { ...newData };
    copy.meta = { ...newData.meta };
    copy.meta.exampleSetting = newSetting;
    setData(copy);
  }

  function cancel() {
    setVisible(false);
    setData({ ...user });
    setEnteredEmail(user.email);
    setEmailError(false);
  }

  return (
    <>
      <Button onClick={() => setVisible(true)}>Edit</Button>

      <Modal show={isModalVisible} onHide={cancel}>
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form>
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                type="text"
                value={newData.name}
                onChange={(e) => changeName(e.target.value)}
                required
                minLength="3"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                ref={emailRef}
                className={"form-control " + (emailError ? "bg-danger text-white" : "")}
                type="email"
                value={enteredEmail}
                onChange={(e) => changeEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-check form-switch mb-3">
              <input
                id="formCheck-1"
                className="form-check-input"
                type="checkbox"
                checked={!!newData.meta.exampleSetting}
                onChange={(e) => changeSetting(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="formCheck-1">
                Example Setting
              </label>
            </div>
            {user.provider === "email_password" && (
              <div className="mb-3">
                <Button onClick={resetPassword}>Change Password</Button>
              </div>
            )}
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancel}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setVisible(false);
              onChange(newData);
            }}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
