import axios, { AxiosError } from "axios";

// Every Axios request in a test must go through this adapter, never the network.
export function mockHttp(t, respond = () => ({ id: 42 })) {
  const previous = axios.defaults.adapter;
  const requests = [];
  axios.defaults.adapter = async (config) => {
    requests.push(config);
    return {
      data: { status: "success", result: await respond(config) },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  t.after(() => { axios.defaults.adapter = previous; });
  return requests;
}

export function httpError(config) {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, undefined, {
    status: 403, statusText: "Forbidden", headers: {}, config,
    data: { status: "error", message: "Access denied" },
  });
}

export function timeoutError(config) {
  return new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED", config);
}
