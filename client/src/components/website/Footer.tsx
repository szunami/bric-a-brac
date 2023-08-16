import styled, { css, keyframes } from "styled-components";
import React, { ChangeEventHandler, FormEvent, useState } from "react";
import { ArrowLongRightIcon } from "@heroicons/react/24/solid";

import { HathoraLogo } from "./HathoraLogo";

export function Footer() {
  return (
    <div className="relative overflow-hidden py-8 md:pt-24 md:pb-24 bg-neutralgray-700">
      <div className={"font-hathora flex flex-col md:grid md:grid-cols-6 max-w-[880px] mx-auto"}>
        <div className={"hidden md:flex md:col-span-2 flex-col items-start"}>
          <div>
          </div>

        </div>
      </div>
      <div className="footer_shadow"> </div>
    </div>
  );
}

const Form = styled.form`
  width: 100%;

  .form__input {
    position: relative;

    .form__message {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      font-size: 0.875rem;
      line-height: 1.42em;

      &--success {
        color: #02fe57;

        & + input {
          border-color: #02fe57;
        }
      }

      &--error {
        color: red;

        & + input {
          border-color: red;
        }
      }
    }
  }

  input {
    width: 100%;
    background: transparent;
    padding-bottom: 12px;
    color: #e5ddf8;
    font-size: 0.875rem;
    line-height: 1.42em;
    border-bottom: 1px solid #af64ee;
    border-radius: 0;
    -webkit-appearance: none;

    &::placeholder {
      color: #8585a6;
      opacity: 1;
    }
  }
`;
const StyledNewsletterForm = styled(Form)`
  input {
    // border-bottom: 0;
  }

  .form__loading-line {
    width: 100%;
    height: 1px;
    top: -1px;
    position: relative;
    overflow: hidden;

    .loading-line {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      bottom: 0;
    }
  }

  .form__submit {
    position: absolute;
    top: 4px;
    right: 0;
    cursor: pointer;
    transition: all 0.2s ease;

    &:disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  }
`;

const validateEmail = (email: string) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
function NewsletterForm() {
  /**
   * State
   */
  const [email, setEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  /**
   * Handles form's submission
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (validateEmail(email)) {
      setLoading(true);

      const payload = {
        fields: [
          {
            name: "email",
            value: email,
          },
        ],
        context: {
          pageUri: window.location.href,
        },
      };

      const response = await fetch(
        "https://api.hsforms.com/submissions/v3/integration/submit/22776178/0f72ee1a-72fe-4eee-a34e-adca0f897f7f",
        {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      )
        .then((res: Response) => res)
        .catch(() => setErrorMessage("Something went wrong. Please try again."));

      if (response && response.status === 200) {
        setSuccessMessage("Thanks for subscribing!");
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }

      setLoading(false);
    } else {
      setErrorMessage("Please enter a valid email address");
    }
  };

  return (
    <StyledNewsletterForm onSubmit={handleSubmit} noValidate>
      <div className="form__input">
        {successMessage && <p className="form__message form__message--success">{successMessage}</p>}

        {errorMessage && <p className="form__message form__message--error">{errorMessage}</p>}

        <input
          type="email"
          name="email"
          value={email}
          placeholder="Your email here"
          onChange={(event) => {
            const {
              target: { value },
            } = event;

            setEmail(value);

            if (successMessage) {
              setSuccessMessage(undefined);
            }
            if (errorMessage) {
              setErrorMessage(undefined);
            }
          }}
          autoComplete="off"
        />

        <button type="submit" className="form__submit d-flex" disabled={!validateEmail(email)}>
          <ArrowLongRightIcon className="ml-0.5 h-5 w-5 text-hathoraBrand-500 group-hover:text-neutralgray-700 stroke-2" />
        </button>

        <div className="form__loading-line">
          <LoadingLine className="loading-line" visible={loading} play={loading} />
        </div>
      </div>
    </StyledNewsletterForm>
  );
}

const Animation = keyframes`
  from {
    transform: translateX(-50%);
  }

  to {
    transform: translateX(100%);
  }
`;

interface LoadingLineProps {
  visible?: boolean;
  play?: boolean;
}
const LoadingLine = styled.div`
  width: 100%;
  height: 1px;
 
  opacity: ${(props: LoadingLineProps) => (props.visible ? "1" : "0")};
  visibility: ${(props: LoadingLineProps) => (props.visible ? "visible" : "hidden")};

  ${(props: LoadingLineProps) =>
    props.play &&
    css`
      animation: ${Animation} 1s linear infinite;
    `}
`;
