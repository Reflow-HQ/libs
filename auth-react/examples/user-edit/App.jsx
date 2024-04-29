import React from "react";
import useAuth from "@reflowhq/auth-react";

import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Button from "react-bootstrap/Button";

import Edit from "./Edit.jsx";

function App() {
  const auth = useAuth({ projectID: 267418190 });

  function signIn() {
    auth.signIn();
  }

  function signOut() {
    auth.signOut();
  }

  function register() {
    auth.register();
  }

  function onEdit(newData) {
    auth
      .updateUser({
        name: newData.name,
        email: newData.email,
        meta: newData.meta,
      })
      .then((result) => {
        if (result.email_update && !result.email_update.verified) {
          alert(
            `A verification email was sent to ${result.email_update.new_email}. Please follow the link in the email to confirm your new address.`
          );
        }
      })
      .catch((e) => {
        alert("Profile update failed!");
      });
  }

  function resetPassword() {
    if (!auth.isSignedIn()) return;

    auth
      .sendPasswordResetLink()
      .then(() => {
        alert(
          `A verification email was sent to ${auth.user.email}. Please follow the link in the email to change your password.`
        );
      })
      .catch((e) => {
        alert("Profile update failed!");
      });
  }

  return (
    <>
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand href="#home">Reflow Auth</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link href="https://reflowhq.com">Home</Nav.Link>
              <Nav.Link href="https://reflowhq.com/docs/">Docs</Nav.Link>
            </Nav>
            {auth.isSignedIn() ? (
              <Button onClick={signOut}>Sign Out</Button>
            ) : (
              <>
                <Button className="me-2" onClick={signIn}>
                  Sign In
                </Button>
                <Button onClick={register}>Register</Button>
              </>
            )}
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="mt-4 d-flex justify-content-center">
        {auth.isSignedIn() ? (
          <Card style={{ width: "24rem" }}>
            <Card.Body>
              <img src={auth.user.photo} className="img-fluid" />
              <Card.Title className="mt-3">{auth.user.name}</Card.Title>
              <Card.Text>Profile data:</Card.Text>
              <pre>{JSON.stringify(auth.user, null, "  ")}</pre>
              <Edit user={auth.user} onChange={onEdit} resetPassword={resetPassword} />
            </Card.Body>
          </Card>
        ) : (
          <p>Too begin, press the Sign in Button</p>
        )}
      </Container>
    </>
  );
}

export default App;
