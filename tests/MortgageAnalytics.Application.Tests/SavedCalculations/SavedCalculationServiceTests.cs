using Microsoft.Extensions.Time.Testing;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;

namespace MortgageAnalytics.Application.Tests.SavedCalculations;

/// <summary>
/// Unit tests for <see cref="SavedCalculationService"/>. The repository is an NSubstitute substitute,
/// so these tests check only the service's own work: ids, times, trimming and mapping.
/// </summary>
[TestFixture]
public class SavedCalculationServiceTests
{
    private const string Owner = "alice-id";

    private ISavedCalculationRepository _repository = null!;
    private FakeTimeProvider _clock = null!;
    private SavedCalculationService _service = null!;

    [SetUp]
    public void CreateService()
    {
        _repository = Substitute.For<ISavedCalculationRepository>();
        _clock = TestClock.Create();
        _service = new SavedCalculationService(_repository, _clock);
    }

    private static SaveCalculationRequest Request(string name = "Oak St", decimal homePrice = 400_000m) =>
        new() { Name = name, Inputs = A.Request.Build() with { HomePrice = homePrice } };

    private static SavedCalculation Stored(string name = "Oak St", DateTimeOffset? at = null) => new()
    {
        Id = Guid.CreateVersion7(),
        OwnerId = Owner,
        Name = name,
        Inputs = A.Request.Build(),
        CreatedAt = at ?? TestClock.Now,
        UpdatedAt = at ?? TestClock.Now,
    };

    [Test]
    public async Task Save_StoresTheTrimmedNameAndInputs_StampedNow()
    {
        SavedCalculation? added = null;
        await _repository.AddAsync(Arg.Do<SavedCalculation>(c => added = c), Arg.Any<CancellationToken>());

        var response = await _service.SaveAsync(Owner, Request("  Oak St  "), CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(added, Is.Not.Null, "the calculation is stored");
            Assert.That(added!.Name, Is.EqualTo("Oak St"), "surrounding spaces are trimmed");
            Assert.That(added.OwnerId, Is.EqualTo(Owner), "it belongs to the person who saved it");
            Assert.That(added.Inputs?.HomePrice, Is.EqualTo(400_000m), "the inputs are stored as given");
            Assert.That(added.CreatedAt, Is.EqualTo(TestClock.Now), "created now");
            Assert.That(added.UpdatedAt, Is.EqualTo(TestClock.Now), "and not yet updated");
            Assert.That(response.Id, Is.EqualTo(added.Id).And.Not.EqualTo(Guid.Empty), "the response carries the new id");
            Assert.That(response.Name, Is.EqualTo("Oak St"), "and the stored name");
        });
    }

    [Test]
    public async Task Save_TellsTheKindsApart_ByTheInputsGiven()
    {
        var refinance = new RefinanceRequest { CurrentBalance = 300_000m, RemainingTermInMonths = 300, NewTermInMonths = 360 };

        var purchase = await _service.SaveAsync(Owner, Request(), CancellationToken.None);
        var comparison = await _service.SaveAsync(Owner, new SaveCalculationRequest { Name = "Refi", Refinance = refinance }, CancellationToken.None);
        var strategy = await _service.SaveAsync(Owner, new SaveCalculationRequest { Name = "Pay off?", Strategy = ReferenceStrategies.TypicalRequest }, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(purchase.Kind, Is.EqualTo(SavedCalculationKind.Purchase), "calculator inputs make a purchase calculation");
            Assert.That(comparison.Kind, Is.EqualTo(SavedCalculationKind.Refinance), "refinance inputs make a refinance comparison");
            Assert.That(comparison.Refinance, Is.SameAs(refinance), "with its inputs");
            Assert.That(comparison.Inputs, Is.Null, "and no calculator inputs");
            Assert.That(strategy.Kind, Is.EqualTo(SavedCalculationKind.Strategy), "strategy inputs make a pay-off-or-invest comparison");
            Assert.That(strategy.Strategy, Is.EqualTo(ReferenceStrategies.TypicalRequest), "with its inputs");
            Assert.That(strategy.Refinance, Is.Null, "and no other kind");
        });
    }

    [Test]
    public async Task Save_KeepsEveryHomeOfAComparison_AsAKindOfItsOwn()
    {
        IReadOnlyList<AmortizationRequest> others = [A.Request.Build() with { HomePrice = 450_000m }, A.Request.Build() with { HomePrice = 380_000m }];

        var saved = await _service.SaveAsync(Owner, Request() with { OtherHomes = others }, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(saved.Kind, Is.EqualTo(SavedCalculationKind.HomeComparison), "several homes make a comparison, not a purchase");
            Assert.That(saved.Inputs?.HomePrice, Is.EqualTo(400_000m), "the first home is the calculator's inputs");
            Assert.That(saved.OtherHomes, Is.SameAs(others), "and the others are kept beside them");
        });
    }

    [Test]
    public async Task Update_ReplacesTheOtherHomes_OrDropsThem()
    {
        var stored = Stored();
        stored.OtherHomes = [A.Request.Build()];
        _repository.FindAsync(Owner, stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var response = await _service.UpdateAsync(Owner, stored.Id, Request(), CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(response?.OtherHomes, Is.Null, "saved over with one home, it is a purchase again");
            Assert.That(response?.Kind, Is.EqualTo(SavedCalculationKind.Purchase), "and is listed as one");
        });
    }

    [Test]
    public async Task Save_GivesEachCalculationItsOwnId()
    {
        var first = await _service.SaveAsync(Owner, Request(), CancellationToken.None);
        var second = await _service.SaveAsync(Owner, Request(), CancellationToken.None);

        Assert.That(second.Id, Is.Not.EqualTo(first.Id), "two saves under the same name are still two calculations");
    }

    [Test]
    public async Task Get_ReturnsTheStoredCalculation()
    {
        var stored = Stored("Maple Ave");
        _repository.FindAsync(Owner, stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var response = await _service.GetAsync(Owner, stored.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(response?.Id, Is.EqualTo(stored.Id), "found by id");
            Assert.That(response?.Name, Is.EqualTo("Maple Ave"), "with its name");
            Assert.That(response?.Inputs, Is.SameAs(stored.Inputs), "and its inputs");
        });
    }

    [Test]
    public async Task Get_ReturnsNull_WhenThereIsNoSuchCalculation()
    {
        var response = await _service.GetAsync(Owner, Guid.NewGuid(), CancellationToken.None);

        Assert.That(response, Is.Null, "the endpoint turns this into a 404");
    }

    [Test]
    public async Task List_PassesTheSearchToStorage_AndKeepsItsOrder()
    {
        var newer = Stored("Oak St, 10% down");
        var older = Stored("Oak St, 20% down");
        _repository.ListAsync(Owner, "oak", Arg.Any<CancellationToken>()).Returns([newer, older]);

        var list = await _service.ListAsync(Owner, "oak", CancellationToken.None);

        Assert.That(list.Select(c => c.Id), Is.EqualTo(new[] { newer.Id, older.Id }), "storage decides the order (most recent first)");
    }

    [Test]
    public async Task Update_ReplacesTheNameAndInputs_AndStampsOnlyTheUpdateTime()
    {
        var stored = Stored("Old name");
        _repository.FindAsync(Owner, stored.Id, Arg.Any<CancellationToken>()).Returns(stored);
        _clock.Advance(TimeSpan.FromDays(1));

        var response = await _service.UpdateAsync(Owner, stored.Id, Request(" New name ", homePrice: 500_000m), CancellationToken.None);

        await _repository.Received(1).UpdateAsync(stored, Arg.Any<CancellationToken>());
        Assert.Multiple(() =>
        {
            Assert.That(response?.Name, Is.EqualTo("New name"), "renamed, trimmed");
            Assert.That(response?.Inputs?.HomePrice, Is.EqualTo(500_000m), "inputs replaced");
            Assert.That(response?.CreatedAt, Is.EqualTo(TestClock.Now), "the creation time never changes");
            Assert.That(response?.UpdatedAt, Is.EqualTo(TestClock.Now.AddDays(1)), "the update time is now");
        });
    }

    [Test]
    public async Task Update_ReturnsNullAndWritesNothing_WhenThereIsNoSuchCalculation()
    {
        var response = await _service.UpdateAsync(Owner, Guid.NewGuid(), Request(), CancellationToken.None);

        Assert.That(response, Is.Null, "the endpoint turns this into a 404");
        await _repository.DidNotReceiveWithAnyArgs().UpdateAsync(default!, default);
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Delete_ReportsWhetherThereWasAnythingToDelete(bool existed)
    {
        var id = Guid.NewGuid();
        _repository.DeleteAsync(Owner, id, Arg.Any<CancellationToken>()).Returns(existed);

        var deleted = await _service.DeleteAsync(Owner, id, CancellationToken.None);

        Assert.That(deleted, Is.EqualTo(existed), "false becomes a 404");
    }
}
