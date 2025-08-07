import { render } from "@testing-library/react";
import EstimationCostChart from "@/app/(admin)/dashboard/reports/EstimationCostChart";

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            estimationId: 1,
            projectName: "Project Alpha",
            vendor: 10000,
            labor: 5000,
          },
        ]),
    })
  ) as jest.Mock;

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("EstimationCostChart", () => {
  it("renders recharts container with mock data", async () => {
    const { container } = render(<EstimationCostChart />);

    // Look for recharts root div by class
    const chartContainer = container.querySelector(".recharts-responsive-container");
    expect(chartContainer).toBeInTheDocument();
  });
});