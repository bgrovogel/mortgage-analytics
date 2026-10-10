using MortgageAnalytics.Domain.HousingCosts;
using static MortgageAnalytics.Domain.Tests.HousingCosts.HousingCostTestData;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class HousingCostBreakdownTests
{
    [Test]
    public void For_GroupsAmountsByCategory_AndTotalsThem()
    {
        IHousingCost[] costs =
        [
            new ValueBasedTax(HousingCostCategory.LocalTax, Flat(250_000m), 2.1m),
            new ValueBasedTax(HousingCostCategory.MudTax, Flat(250_000m), 0.85m),
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m),
        ];

        var breakdown = HousingCostBreakdown.For(costs, Period(1));

        Assert.Multiple(() =>
        {
            Assert.That(breakdown[HousingCostCategory.LocalTax], Is.EqualTo(437.50m), "2.1% of $250,000 / 12");
            Assert.That(breakdown[HousingCostCategory.MudTax], Is.EqualTo(177.08m), "0.85% of $250,000 / 12");
            Assert.That(breakdown[HousingCostCategory.HoaDues], Is.EqualTo(75m), "flat dues");
            Assert.That(breakdown[HousingCostCategory.MortgageInsurance], Is.Zero, "absent categories read as zero");
            Assert.That(breakdown.Total, Is.EqualTo(689.58m), "the total is the sum of every category");
        });
    }

    [Test]
    public void For_AddsTwoCostsInTheSameCategory()
    {
        IHousingCost[] costs =
        [
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 50m),
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 25m),
        ];

        var breakdown = HousingCostBreakdown.For(costs, Period(1));

        Assert.That(breakdown[HousingCostCategory.HoaDues], Is.EqualTo(75m), "a master HOA plus a sub-HOA are both dues");
    }

    [Test]
    public void Sum_AddsCategoryByCategory()
    {
        var month = HousingCostBreakdown.For([new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m)], Period(1));

        var year = HousingCostBreakdown.Sum(Enumerable.Repeat(month, 12));

        Assert.Multiple(() =>
        {
            Assert.That(year[HousingCostCategory.HoaDues], Is.EqualTo(900m), "12 x $75");
            Assert.That(year.Total, Is.EqualTo(900m), "the total follows the categories");
        });
    }

    [Test]
    public void Empty_HasNothingInIt()
    {
        Assert.That(HousingCostBreakdown.Empty.Total, Is.Zero, "an empty breakdown totals zero");
    }
}
