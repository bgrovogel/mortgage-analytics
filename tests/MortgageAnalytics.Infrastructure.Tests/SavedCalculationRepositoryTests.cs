using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Infrastructure.Tests;

[TestFixture]
public class SavedCalculationRepositoryTests : RepositoryTestBase
{
    [Test]
    public async Task Add_ThenFind_KeepsEveryInput()
    {
        var inputs = A.Request.FivePercentDown()
            .WithMonthlyExtra(300).WithAnnualExtra(2_000).WithLumpSum(12, 25_000).WithRecast(10_000, 250)
            .WithHousingCosts(c => c.WithSchoolTax(1).WithMudTax(0.85m).AsHomestead().WithOver65(qualifiesInYear: 3)
                .WithPid(1_200, 12).WithInsurance(2_400, 5).WithHoa(50, 3).WithPmi(0.5m, PmiCancellation.BorrowerRequested))
            .Build();
        var saved = ACalculation("Every option", inputs: inputs);
        await SeedAsync(saved);

        var found = await NewRepository().FindAsync(saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.Name, Is.EqualTo("Every option"), "the name is stored");
            Assert.That(found is null ? null : JsonOf(found.Inputs!), Is.EqualTo(JsonOf(inputs)), "every input survives the round trip");
            Assert.That(found?.CreatedAt, Is.EqualTo(saved.CreatedAt), "the creation time is stored exactly");
            Assert.That(found?.UpdatedAt, Is.EqualTo(saved.UpdatedAt), "and the update time");
        });
    }

    [Test]
    public async Task ARefinanceComparison_RoundTrips()
    {
        var refinance = new RefinanceRequest
        {
            CurrentBalance = 300_000m, CurrentAnnualInterestRate = 7m, RemainingTermInMonths = 300,
            NewAnnualInterestRate = 6m, NewTermInMonths = 360, ClosingCosts = 6_000m, FinanceClosingCosts = true,
        };
        var saved = ACalculation("Refi");
        saved.Inputs = null;
        saved.Refinance = refinance;
        await SeedAsync(saved);

        var found = await NewRepository().FindAsync(saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.Refinance, Is.EqualTo(refinance), "the comparison is stored whole");
            Assert.That(found?.Inputs, Is.Null, "with no calculator inputs");
        });
    }

    [Test]
    public async Task Find_ReturnsNull_ForAnUnknownId()
    {
        var found = await NewRepository().FindAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.That(found, Is.Null, "nothing was saved under that id");
    }

    [Test]
    public async Task List_PutsTheMostRecentlyChangedFirst()
    {
        await SeedAsync(ACalculation("Oldest", 0), ACalculation("Newest", 20), ACalculation("Middle", 10));

        var list = await NewRepository().ListAsync(null, CancellationToken.None);

        Assert.That(list.Select(c => c.Name), Is.EqualTo(new[] { "Newest", "Middle", "Oldest" }), "the latest work is at the top");
    }

    [TestCase("oak", new[] { "Oak St, 20% down", "Big OAK tree" })]
    [TestCase("20%", new[] { "Oak St, 20% down" })]
    [TestCase("_", new string[0])]
    [TestCase("  ", new[] { "Oak St, 20% down", "Maple Ave", "Big OAK tree" })]
    public async Task List_FiltersByName_IgnoringCase_AndTakesTheSearchLiterally(string search, string[] expected)
    {
        await SeedAsync(ACalculation("Big OAK tree", 0), ACalculation("Maple Ave", 1), ACalculation("Oak St, 20% down", 2));

        var list = await NewRepository().ListAsync(search, CancellationToken.None);

        Assert.That(list.Select(c => c.Name), Is.EqualTo(expected), $"searching for \"{search}\" (a blank search keeps everything)");
    }

    [Test]
    public async Task Update_WritesTheChanges()
    {
        var saved = ACalculation("Before");
        await SeedAsync(saved);
        var repository = NewRepository();
        var calculation = (await repository.FindAsync(saved.Id, CancellationToken.None))!;

        calculation.Name = "After";
        calculation.Inputs = A.Request.WithHomePrice(500_000).Build();
        calculation.UpdatedAt = TestClock.Now.AddDays(1);
        await repository.UpdateAsync(calculation, CancellationToken.None);

        var reread = await NewRepository().FindAsync(saved.Id, CancellationToken.None);
        Assert.Multiple(() =>
        {
            Assert.That(reread?.Name, Is.EqualTo("After"), "the new name is stored");
            Assert.That(reread?.Inputs?.HomePrice, Is.EqualTo(500_000m), "replacing the inputs is detected and stored");
            Assert.That(reread?.UpdatedAt, Is.EqualTo(TestClock.Now.AddDays(1)), "and the update time");
        });
    }

    [Test]
    public async Task Delete_RemovesIt_AndReportsWhetherAnythingWasThere()
    {
        var saved = ACalculation();
        await SeedAsync(saved);

        var first = await NewRepository().DeleteAsync(saved.Id, CancellationToken.None);
        var second = await NewRepository().DeleteAsync(saved.Id, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(first, Is.True, "the first delete removes it");
            Assert.That(second, Is.False, "the second finds nothing");
            Assert.That(await NewRepository().FindAsync(saved.Id, CancellationToken.None), Is.Null, "it is gone");
        });
    }

    [Test]
    public void TheMigrations_MatchTheModel()
    {
        using var context = NewContext();

        Assert.That(context.Database.HasPendingModelChanges(), Is.False, "run `dotnet ef migrations add` after changing the model");
    }
}
