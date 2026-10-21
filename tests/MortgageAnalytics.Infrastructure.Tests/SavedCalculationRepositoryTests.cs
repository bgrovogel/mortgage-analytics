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

        var found = await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.Name, Is.EqualTo("Every option"), "the name is stored");
            Assert.That(found is null ? null : JsonOf(found.Inputs!), Is.EqualTo(JsonOf(inputs)), "every input survives the round trip");
            Assert.That(found?.CreatedAt, Is.EqualTo(saved.CreatedAt), "the creation time is stored exactly");
            Assert.That(found?.UpdatedAt, Is.EqualTo(saved.UpdatedAt), "and the update time");
        });
    }

    [Test]
    public async Task ANote_RoundTrips_AndNoNoteStaysNull()
    {
        var withNote = ACalculation("Has a note");
        withNote.Note = "Ask about the roof: 15 years old.";
        var without = ACalculation("No note", minutesLater: 1);
        await SeedAsync(withNote, without);

        var repository = NewRepository();

        Assert.Multiple(async () =>
        {
            Assert.That((await repository.FindAsync(Alice, withNote.Id, CancellationToken.None))?.Note, Is.EqualTo("Ask about the roof: 15 years old."), "the note is stored");
            Assert.That((await repository.FindAsync(Alice, without.Id, CancellationToken.None))?.Note, Is.Null, "a calculation without one has none");
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

        var found = await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.Refinance, Is.EqualTo(refinance), "the comparison is stored whole");
            Assert.That(found?.Inputs, Is.Null, "with no calculator inputs");
        });
    }

    [Test]
    public async Task AStrategyComparison_RoundTrips()
    {
        var strategy = ReferenceStrategies.TypicalRequest with
        {
            FilingStatus = TaxFilingStatus.HeadOfHousehold,
            RiskProfile = InvestorRiskProfile.Conservative,
            SellRsusAtVest = true,
            AnnualRsuVesting = 12_000m,
        };
        var saved = ACalculation("Pay off or invest");
        saved.Inputs = null;
        saved.Strategy = strategy;
        await SeedAsync(saved);

        var found = await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.Strategy, Is.EqualTo(strategy), "every input, enums included, is stored whole");
            Assert.That(found?.Kind, Is.EqualTo(SavedCalculationKind.Strategy), "and it reads back as a strategy comparison");
        });
    }

    [Test]
    public async Task AHomeComparison_RoundTrips()
    {
        IReadOnlyList<AmortizationRequest> others =
            [A.Request.Build() with { HomePrice = 450_000m, DownPayment = 90_000m }, A.Request.Build() with { HomePrice = 380_000m }, A.Request.Build() with { AnnualInterestRate = 5.5m }];
        var saved = ACalculation("Four streets");
        saved.OtherHomes = others;
        await SeedAsync(saved);

        var found = await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.OtherHomes, Is.EqualTo(others), "the other homes are stored whole, in order, beside the first");
            Assert.That(found?.Inputs, Is.EqualTo(saved.Inputs), "and the first is kept as it was");
            Assert.That(found?.Kind, Is.EqualTo(SavedCalculationKind.HomeComparison), "so it reads back as a comparison");
        });
    }

    [Test]
    public async Task Find_ReturnsNull_ForAnUnknownId()
    {
        var found = await NewRepository().FindAsync(Alice, Guid.NewGuid(), CancellationToken.None);

        Assert.That(found, Is.Null, "nothing was saved under that id");
    }

    [Test]
    public async Task List_PutsTheMostRecentlyChangedFirst()
    {
        await SeedAsync(ACalculation("Oldest", 0), ACalculation("Newest", 20), ACalculation("Middle", 10));

        var list = await NewRepository().ListAsync(Alice, null, CancellationToken.None);

        Assert.That(list.Select(c => c.Name), Is.EqualTo(new[] { "Newest", "Middle", "Oldest" }), "the latest work is at the top");
    }

    [TestCase("oak", new[] { "Oak St, 20% down", "Big OAK tree" })]
    [TestCase("20%", new[] { "Oak St, 20% down" })]
    [TestCase("_", new string[0])]
    [TestCase("  ", new[] { "Oak St, 20% down", "Maple Ave", "Big OAK tree" })]
    public async Task List_FiltersByName_IgnoringCase_AndTakesTheSearchLiterally(string search, string[] expected)
    {
        await SeedAsync(ACalculation("Big OAK tree", 0), ACalculation("Maple Ave", 1), ACalculation("Oak St, 20% down", 2));

        var list = await NewRepository().ListAsync(Alice, search, CancellationToken.None);

        Assert.That(list.Select(c => c.Name), Is.EqualTo(expected), $"searching for \"{search}\" (a blank search keeps everything)");
    }

    [Test]
    public async Task List_AlsoFindsAWordInTheNote_IgnoringCase_AndANoteIsNotFoundByAnotherOwnersSearch()
    {
        var roof = ACalculation("Elm Ct", 0);
        roof.Note = "Ask about the ROOF: 15 years old";
        var bobs = ACalculation("Pine Rd", 1, owner: Bob);
        bobs.Note = "roof is new";
        await SeedAsync(roof, ACalculation("Oak St", 1), bobs);

        var found = await NewRepository().ListAsync(Alice, "roof", CancellationToken.None);
        var nameOrNote = await NewRepository().ListAsync(Alice, "oak", CancellationToken.None);
        var literal = await NewRepository().ListAsync(Alice, "15 years", CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found.Select(c => c.Name), Is.EqualTo(new[] { "Elm Ct" }), "a word in the note finds the calculation, whatever its case, and only Alice's");
            Assert.That(nameOrNote.Select(c => c.Name), Is.EqualTo(new[] { "Oak St" }), "a name still finds it, with or without a note on the others");
            Assert.That(literal.Select(c => c.Name), Is.EqualTo(new[] { "Elm Ct" }), "a phrase in the note is found as typed");
        });
    }

    [Test]
    public async Task Update_WritesTheChanges()
    {
        var saved = ACalculation("Before");
        await SeedAsync(saved);
        var repository = NewRepository();
        var calculation = (await repository.FindAsync(Alice, saved.Id, CancellationToken.None))!;

        calculation.Name = "After";
        calculation.Inputs = A.Request.WithHomePrice(500_000).Build();
        calculation.UpdatedAt = TestClock.Now.AddDays(1);
        await repository.UpdateAsync(calculation, CancellationToken.None);

        var reread = await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None);
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

        var first = await NewRepository().DeleteAsync(Alice, saved.Id, CancellationToken.None);
        var second = await NewRepository().DeleteAsync(Alice, saved.Id, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(first, Is.True, "the first delete removes it");
            Assert.That(second, Is.False, "the second finds nothing");
            Assert.That(await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None), Is.Null, "it is gone");
        });
    }

    [Test]
    public void TheMigrations_MatchTheModel()
    {
        using var context = NewContext();

        Assert.That(context.Database.HasPendingModelChanges(), Is.False, "run `dotnet ef migrations add` after changing the model");
    }

    [Test]
    public async Task EachOwner_SeesOnlyTheirOwnCalculations()
    {
        var mine = ACalculation("Mine");
        var theirs = ACalculation("Theirs", owner: Bob);
        await SeedAsync(mine, theirs);

        var myList = await NewRepository().ListAsync(Alice, null, CancellationToken.None);
        var foundTheirs = await NewRepository().FindAsync(Alice, theirs.Id, CancellationToken.None);
        var deletedTheirs = await NewRepository().DeleteAsync(Alice, theirs.Id, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(myList.Select(c => c.Name), Is.EqualTo(new[] { "Mine" }), "the list holds only the owner's calculations");
            Assert.That(foundTheirs, Is.Null, "another owner's calculation is not found, as if it did not exist");
            Assert.That(deletedTheirs, Is.False, "and cannot be deleted");
            Assert.That(await NewRepository().FindAsync(Bob, theirs.Id, CancellationToken.None), Is.Not.Null, "it is still there for its owner");
        });
    }

    [Test]
    public async Task DeletingAUser_DeletesTheirCalculations_AndNoOneElses()
    {
        await SeedAsync(ACalculation("Alice's first"), ACalculation("Alice's second", minutesLater: 1), ACalculation("Bob's", owner: Bob));

        // The calculations are not loaded, so only the database's own cascade can remove them.
        await using (var context = NewContext())
        {
            context.Users.Remove(await context.Users.SingleAsync(u => u.Id == Alice));
            await context.SaveChangesAsync();
        }

        await using var check = NewContext();
        var left = await check.SavedCalculations.Select(c => c.Name).ToListAsync();

        Assert.That(left, Is.EqualTo(new[] { "Bob's" }), "a deleted user's calculations go with them, and everyone else's stay");
    }

    [Test]
    public async Task Tags_RoundTrip_InOrder_AndNoTagsComesBackEmpty()
    {
        var tagged = ACalculation("Has tags");
        tagged.Tags = ["Oak St", "roof", "second look"];
        var untagged = ACalculation("No tags", minutesLater: 1);
        await SeedAsync(tagged, untagged);

        var repository = NewRepository();

        Assert.Multiple(async () =>
        {
            Assert.That((await repository.FindAsync(Alice, tagged.Id, CancellationToken.None))?.Tags, Is.EqualTo(new[] { "Oak St", "roof", "second look" }), "the tags are stored, in the order given");
            Assert.That((await repository.FindAsync(Alice, untagged.Id, CancellationToken.None))?.Tags, Is.Empty, "a calculation without any has an empty list");
        });
    }

    [Test]
    public async Task List_AlsoFindsATag_IgnoringCase_AndOnlyInTheOwnersCalculations()
    {
        var tagged = ACalculation("Elm Ct", 0);
        tagged.Tags = ["Second look", "ROOF"];
        var bobs = ACalculation("Pine Rd", 1, owner: Bob);
        bobs.Tags = ["roof"];
        await SeedAsync(tagged, ACalculation("Oak St", 1), bobs);

        var byTag = await NewRepository().ListAsync(Alice, "roof", CancellationToken.None);
        var byPhrase = await NewRepository().ListAsync(Alice, "second look", CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(byTag.Select(c => c.Name), Is.EqualTo(new[] { "Elm Ct" }), "a tag finds the calculation, whatever its case, and only Alice's");
            Assert.That(byPhrase.Select(c => c.Name), Is.EqualTo(new[] { "Elm Ct" }), "a tag of two words is found as typed");
        });
    }
}
