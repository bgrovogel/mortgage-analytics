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

        var response = await _service.SaveAsync(Request("  Oak St  "), CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(added, Is.Not.Null, "the calculation is stored");
            Assert.That(added!.Name, Is.EqualTo("Oak St"), "surrounding spaces are trimmed");
            Assert.That(added.Inputs.HomePrice, Is.EqualTo(400_000m), "the inputs are stored as given");
            Assert.That(added.CreatedAt, Is.EqualTo(TestClock.Now), "created now");
            Assert.That(added.UpdatedAt, Is.EqualTo(TestClock.Now), "and not yet updated");
            Assert.That(response.Id, Is.EqualTo(added.Id).And.Not.EqualTo(Guid.Empty), "the response carries the new id");
            Assert.That(response.Name, Is.EqualTo("Oak St"), "and the stored name");
        });
    }

    [Test]
    public async Task Save_GivesEachCalculationItsOwnId()
    {
        var first = await _service.SaveAsync(Request(), CancellationToken.None);
        var second = await _service.SaveAsync(Request(), CancellationToken.None);

        Assert.That(second.Id, Is.Not.EqualTo(first.Id), "two saves under the same name are still two calculations");
    }

    [Test]
    public async Task Get_ReturnsTheStoredCalculation()
    {
        var stored = Stored("Maple Ave");
        _repository.FindAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var response = await _service.GetAsync(stored.Id, CancellationToken.None);

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
        var response = await _service.GetAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.That(response, Is.Null, "the endpoint turns this into a 404");
    }

    [Test]
    public async Task List_PassesTheSearchToStorage_AndKeepsItsOrder()
    {
        var newer = Stored("Oak St, 10% down");
        var older = Stored("Oak St, 20% down");
        _repository.ListAsync("oak", Arg.Any<CancellationToken>()).Returns([newer, older]);

        var list = await _service.ListAsync("oak", CancellationToken.None);

        Assert.That(list.Select(c => c.Id), Is.EqualTo(new[] { newer.Id, older.Id }), "storage decides the order (most recent first)");
    }

    [Test]
    public async Task Update_ReplacesTheNameAndInputs_AndStampsOnlyTheUpdateTime()
    {
        var stored = Stored("Old name");
        _repository.FindAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);
        _clock.Advance(TimeSpan.FromDays(1));

        var response = await _service.UpdateAsync(stored.Id, Request(" New name ", homePrice: 500_000m), CancellationToken.None);

        await _repository.Received(1).UpdateAsync(stored, Arg.Any<CancellationToken>());
        Assert.Multiple(() =>
        {
            Assert.That(response?.Name, Is.EqualTo("New name"), "renamed, trimmed");
            Assert.That(response?.Inputs.HomePrice, Is.EqualTo(500_000m), "inputs replaced");
            Assert.That(response?.CreatedAt, Is.EqualTo(TestClock.Now), "the creation time never changes");
            Assert.That(response?.UpdatedAt, Is.EqualTo(TestClock.Now.AddDays(1)), "the update time is now");
        });
    }

    [Test]
    public async Task Update_ReturnsNullAndWritesNothing_WhenThereIsNoSuchCalculation()
    {
        var response = await _service.UpdateAsync(Guid.NewGuid(), Request(), CancellationToken.None);

        Assert.That(response, Is.Null, "the endpoint turns this into a 404");
        await _repository.DidNotReceiveWithAnyArgs().UpdateAsync(default!, default);
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Delete_ReportsWhetherThereWasAnythingToDelete(bool existed)
    {
        var id = Guid.NewGuid();
        _repository.DeleteAsync(id, Arg.Any<CancellationToken>()).Returns(existed);

        var deleted = await _service.DeleteAsync(id, CancellationToken.None);

        Assert.That(deleted, Is.EqualTo(existed), "false becomes a 404");
    }
}
