using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Infrastructure.Tests;

[TestFixture]
public class UserPreferencesRepositoryTests : RepositoryTestBase
{
    private static readonly KeyFigurePreferences Arranged = new() { Order = ["payoff", "cash", "afford"], Hidden = ["afford"] };

    [Test]
    public async Task AUserWhoHasNotArranged_GetsAnEmptyArrangement()
    {
        var found = await NewPreferences().GetKeyFiguresAsync(Alice, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found.Order, Is.Empty, "nothing chosen, so the page's own order");
            Assert.That(found.Hidden, Is.Empty, "and nothing put away");
        });
    }

    [Test]
    public async Task ASavedArrangement_ComesBackInTheSameOrder()
    {
        await NewPreferences().SaveKeyFiguresAsync(Alice, Arranged, CancellationToken.None);

        var found = await NewPreferences().GetKeyFiguresAsync(Alice, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found.Order, Is.EqualTo(Arranged.Order), "the order is the user's, not alphabetical");
            Assert.That(found.Hidden, Is.EqualTo(Arranged.Hidden), "and what is put away");
        });
    }

    [Test]
    public async Task SavingAgain_ReplacesTheArrangement_RatherThanAddingToIt()
    {
        await NewPreferences().SaveKeyFiguresAsync(Alice, Arranged, CancellationToken.None);
        await NewPreferences().SaveKeyFiguresAsync(Alice, new KeyFigurePreferences { Order = ["cash"] }, CancellationToken.None);

        var found = await NewPreferences().GetKeyFiguresAsync(Alice, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found.Order, Is.EqualTo(new[] { "cash" }), "the new order alone");
            Assert.That(found.Hidden, Is.Empty, "nothing is left of the old one");
        });
    }

    [Test]
    public async Task DeletingTheUser_DeletesTheirArrangement()
    {
        await NewPreferences().SaveKeyFiguresAsync(Alice, Arranged, CancellationToken.None);

        await using (var context = NewContext())
            await context.Users.Where(u => u.Id == Alice).ExecuteDeleteAsync();

        Assert.That((await NewPreferences().GetKeyFiguresAsync(Alice, CancellationToken.None)).Order, Is.Empty, "the arrangement goes with the account");
    }

    [Test]
    public async Task EachUser_HasTheirOwnArrangement()
    {
        await NewPreferences().SaveKeyFiguresAsync(Alice, Arranged, CancellationToken.None);

        var bobs = await NewPreferences().GetKeyFiguresAsync(Bob, CancellationToken.None);

        Assert.That(bobs.Order, Is.Empty, "Bob has none, whatever Alice chose");
    }
}
